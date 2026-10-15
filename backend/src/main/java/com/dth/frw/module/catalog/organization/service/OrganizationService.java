package com.dth.frw.module.catalog.organization.service;

import com.dth.frw.domain.catalog.organization.Organization;
import com.dth.frw.domain.catalog.organization.OrganizationStatus;
import com.dth.frw.module.catalog.organization.api.dto.OrganizationPatchRequest;
import com.dth.frw.module.catalog.organization.api.dto.OrganizationRequest;
import com.dth.frw.module.catalog.organization.repo.OrganizationRepository;
import com.dth.frw.module.catalog.organization.repo.OrganizationSpecifications;
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

/**
 * The organization feature's own logic, and the entry point other features use
 * to resolve one — the department feature reaches an organization through
 * {@link #get(Long)} rather than through {@code OrganizationRepository}, so an
 * unknown id produces the same 404 this resource's own endpoints would.
 */
@Service
@Transactional(readOnly = true)
public class OrganizationService {

    /** Sort properties the list endpoint accepts; anything else is ignored. */
    private static final Set<String> SORTABLE =
            Set.of("id", "code", "name", "status", "createdAt", "updatedAt");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id"));

    private final OrganizationRepository repository;

    // Which rows this caller may reach, folded into the query rather than
    // filtered afterwards.
    private final RowLevelSecurity rowLevel;

    public OrganizationService(OrganizationRepository repository, RowLevelSecurity rowLevel) {
        this.repository = repository;
        this.rowLevel = rowLevel;
    }

    public Page<Organization> list(ListParams params) {
        return repository.findAll(
                // The scope first, the caller's filters second: Specification.and
                // has no subtraction, so no query string can widen it.
                rowLevel.scope(Organization.class, Action.READ)
                        .and(OrganizationSpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public Organization get(Long id) {
        return repository.findOne(rowLevel.byId(Organization.class, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException("Organization", id));
    }

    /** Resolves the ids a {@code getMany} request asked for, in one query. */
    public List<Organization> getMany(List<Long> ids) {
        return repository.findAll(rowLevel.byIds(Organization.class, Action.READ, ids));
    }

    @Transactional
    public Organization create(OrganizationRequest request) {
        String code = request.code().trim();
        requireCodeAvailable(code, null);

        Organization organization = new Organization(
                code,
                request.name().trim(),
                trimToNull(request.description()),
                request.status() == null ? OrganizationStatus.ACTIVE : request.status());
        organization.setEmail(trimToNull(request.email()));
        organization.setPhone(trimToNull(request.phone()));
        organization.setAddress(trimToNull(request.address()));

        Organization saved = repository.persist(organization);
        // Flushed first: the identity key and the @PrePersist stamp only exist
        // afterwards, and checking a policy against a half-built row is wrong
        // in every case.
        repository.flush();
        rowLevel.checkWritable(saved);
        return saved;
    }

    @Transactional
    public Organization update(Long id, OrganizationPatchRequest request) {
        // USING, on the state as it stands. Out of scope is a 404, which is
        // deliberately indistinguishable from "no such organization".
        Organization organization = repository
                .findOne(rowLevel.byId(Organization.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException("Organization", id));

        if (request.code() != null) {
            String code = request.code().trim();
            requireCodeAvailable(code, organization.getId());
            organization.setCode(code);
        }
        if (request.name() != null) {
            organization.setName(request.name().trim());
        }
        if (request.description() != null) {
            organization.setDescription(trimToNull(request.description()));
        }
        if (request.email() != null) {
            organization.setEmail(trimToNull(request.email()));
        }
        if (request.phone() != null) {
            organization.setPhone(trimToNull(request.phone()));
        }
        if (request.address() != null) {
            organization.setAddress(trimToNull(request.address()));
        }
        if (request.status() != null) {
            organization.setStatus(request.status());
        }

        // WITH CHECK, on the state this save would leave behind.
        rowLevel.checkWritable(organization);
        return repository.persist(organization);
    }

    /**
     * Deletes an organization.
     *
     * <p>One that still has departments is refused by the {@code RESTRICT}
     * foreign key on {@code departments}, which surfaces as the same 409 a
     * category still in use produces. Counting the departments here instead
     * would mean reading the department feature's table from inside this one,
     * which is the coupling the package layout exists to prevent.
     */
    @Transactional
    public Organization delete(Long id) {
        // Its own action, not a read followed by a delete: somebody may see a
        // row without being allowed to remove it.
        Organization organization = repository
                .findOne(rowLevel.byId(Organization.class, Action.DELETE, id))
                .orElseThrow(() -> new ResourceNotFoundException("Organization", id));
        repository.remove(organization);
        // Returned so the controller can echo the deleted row: the data
        // provider parses the DELETE response body.
        return organization;
    }

    /** Rejects a duplicate code with a message about the field, not the index. */
    private void requireCodeAvailable(String code, Long selfId) {
        repository.findByCodeIgnoreCase(code).ifPresent(existing -> {
            if (!existing.getId().equals(selfId)) {
                throw new ConflictException(
                        "An organization with the code %s already exists".formatted(code));
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
