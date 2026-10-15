package com.dth.frw.module.catalog.department.service;

import com.dth.frw.domain.catalog.department.Department;
import com.dth.frw.domain.catalog.department.DepartmentStatus;
import com.dth.frw.domain.catalog.organization.Organization;
import com.dth.frw.module.catalog.department.api.dto.DepartmentPatchRequest;
import com.dth.frw.module.catalog.department.api.dto.DepartmentRequest;
import com.dth.frw.module.catalog.department.repo.DepartmentRepository;
import com.dth.frw.module.catalog.department.repo.DepartmentSpecifications;
import com.dth.frw.module.catalog.organization.service.OrganizationService;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.web.ListParams;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DepartmentService {

    /** Sort properties the list endpoint accepts; anything else is ignored. */
    private static final Set<String> SORTABLE =
            Set.of("id", "code", "name", "status", "createdAt", "updatedAt");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id"));

    private final DepartmentRepository repository;

    // Resolving an organization goes through the organization feature's own
    // service rather than its repository: a feature reaching into another
    // feature's repo layer is the coupling this package layout exists to
    // prevent.
    private final OrganizationService organizationService;

    // Which rows this caller may reach, folded into the query rather than
    // filtered afterwards.
    private final RowLevelSecurity rowLevel;

    public DepartmentService(DepartmentRepository repository,
                             OrganizationService organizationService,
                             RowLevelSecurity rowLevel) {
        this.repository = repository;
        this.organizationService = organizationService;
        this.rowLevel = rowLevel;
    }

    public Page<Department> list(ListParams params) {
        return repository.findAll(
                // The scope first, the caller's filters second: Specification.and
                // has no subtraction, so no query string can widen it.
                rowLevel.scope(Department.class, Action.READ)
                        .and(DepartmentSpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public Department get(Long id) {
        return repository.findOne(rowLevel.byId(Department.class, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException("Department", id));
    }

    /** Resolves the ids a {@code getMany} request asked for, in one query. */
    public List<Department> getMany(List<Long> ids) {
        return repository.findAll(rowLevel.byIds(Department.class, Action.READ, ids));
    }

    @Transactional
    public Department create(DepartmentRequest request) {
        Organization organization = organization(request.organization().id());
        String code = request.code().trim();
        requireCodeAvailable(organization, code, null);

        Department department = new Department(
                code,
                request.name().trim(),
                trimToNull(request.description()),
                organization,
                request.status() == null ? DepartmentStatus.ACTIVE : request.status());
        department.setEmail(trimToNull(request.email()));
        department.setPhone(trimToNull(request.phone()));

        Department saved = repository.persist(department);
        // Flushed first: the identity key and the @PrePersist stamp only exist
        // afterwards, and checking a policy against a half-built row is wrong
        // in every case.
        repository.flush();
        rowLevel.checkWritable(saved);
        return saved;
    }

    @Transactional
    public Department update(Long id, DepartmentPatchRequest request) {
        // USING, on the state as it stands. Out of scope is a 404, which is
        // deliberately indistinguishable from "no such department".
        Department department = repository
                .findOne(rowLevel.byId(Department.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException("Department", id));

        // Where the department is going, worked out before anything is written
        // to it. Both halves matter to the check: a code is only unique within
        // one organization, so a move and a rename arriving in the same request
        // have to be checked against the destination, not against where the
        // department is now.
        //
        // The order is not cosmetic. Mutating the entity first and querying
        // afterwards lets Hibernate's auto-flush push the update ahead of the
        // check, so the unique index raises the violation and the caller gets
        // the generic 409 about a referenced record instead of a message naming
        // the organization and the code.
        Organization target = request.organization() != null && request.organization().id() != null
                ? organization(request.organization().id())
                : department.getOrganization();
        String targetCode = request.code() != null ? request.code().trim() : department.getCode();

        boolean moved = !target.getId().equals(department.getOrganization().getId());
        if (request.code() != null || moved) {
            requireCodeAvailable(target, targetCode, department.getId());
        }

        department.setOrganization(target);
        department.setCode(targetCode);

        if (request.name() != null) {
            department.setName(request.name().trim());
        }
        if (request.description() != null) {
            department.setDescription(trimToNull(request.description()));
        }
        if (request.email() != null) {
            department.setEmail(trimToNull(request.email()));
        }
        if (request.phone() != null) {
            department.setPhone(trimToNull(request.phone()));
        }
        if (request.status() != null) {
            department.setStatus(request.status());
        }

        // WITH CHECK, on the state this save would leave behind. This is what
        // stops a department being moved into an organization the writer cannot
        // reach, which would put it out of their own sight.
        rowLevel.checkWritable(department);
        return repository.persist(department);
    }

    @Transactional
    public Department delete(Long id) {
        // Its own action, not a read followed by a delete: somebody may see a
        // row without being allowed to remove it.
        Department department = repository
                .findOne(rowLevel.byId(Department.class, Action.DELETE, id))
                .orElseThrow(() -> new ResourceNotFoundException("Department", id));
        repository.remove(department);
        // Returned so the controller can echo the deleted row: the data
        // provider parses the DELETE response body.
        return department;
    }

    /** Raises the same 404 as the organization endpoints would for an unknown id. */
    private Organization organization(Long organizationId) {
        return organizationService.get(organizationId);
    }

    /**
     * Rejects a duplicate code with a message about the field, not the index.
     *
     * <p>Scoped to one organization, matching the unique constraint on the
     * table: {@code SALES} in two different companies is the normal case.
     */
    private void requireCodeAvailable(Organization organization, String code, Long selfId) {
        repository.findByOrganizationIdAndCodeIgnoreCase(organization.getId(), code)
                .ifPresent(existing -> {
                    if (!existing.getId().equals(selfId)) {
                        throw new ConflictException(
                                "%s already has a department with the code %s"
                                        .formatted(organization.getName(), code));
                    }
                });
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
