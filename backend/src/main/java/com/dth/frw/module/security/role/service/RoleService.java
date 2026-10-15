package com.dth.frw.module.security.role.service;

import com.dth.frw.domain.security.permission.Permission;
import com.dth.frw.domain.security.role.Role;
import com.dth.frw.module.security.permission.service.PermissionService;
import com.dth.frw.module.security.role.api.dto.PermissionRef;
import com.dth.frw.module.security.role.api.dto.RolePatchRequest;
import com.dth.frw.module.security.role.api.dto.RoleRequest;
import com.dth.frw.module.security.role.repo.RoleRepository;
import com.dth.frw.module.security.role.repo.RoleSpecifications;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.security.AuthoritiesChanged;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.web.ListParams;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class RoleService {

    /** Sort properties the list endpoint accepts; anything else is ignored. */
    private static final Set<String> SORTABLE = Set.of("id", "code", "name", "systemRole");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("code"));

    private final RoleRepository repository;

    // Permissions are resolved through the permission feature's own service
    // rather than its repository: a feature reaching into another feature's
    // repo layer is the coupling this package layout exists to prevent. It also
    // means an unknown permission id produces the same 404 the permission
    // endpoints would.
    private final PermissionService permissionService;

    // Announces that a role's grants moved. Every account holding it is
    // affected, and working out which accounts those are would mean reading the
    // user feature's table from in here — see AuthoritiesChanged.ForEveryone
    // for why the blunt answer is the right one.
    private final ApplicationEventPublisher events;

    public RoleService(RoleRepository repository,
                       PermissionService permissionService,
                       ApplicationEventPublisher events) {
        this.repository = repository;
        this.permissionService = permissionService;
        this.events = events;
    }

    public Page<Role> list(ListParams params) {
        return repository.findAll(
                RoleSpecifications.from(params),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public Role get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role", id));
    }

    public List<Role> getMany(List<Long> ids) {
        return repository.findAllById(ids);
    }

    /**
     * Resolves the roles a user is being assigned, refusing the whole set if
     * any one id is unknown.
     *
     * <p>This is the entry point the user feature uses. Dropping an unknown id
     * silently would save an account with fewer permissions than the request
     * asked for while reporting success — the worst outcome for a change whose
     * entire purpose is to decide what someone can do.
     */
    public List<Role> resolveAll(List<Long> ids) {
        List<Role> found = repository.findAllById(ids);
        if (found.size() != Set.copyOf(ids).size()) {
            Set<Long> foundIds = new LinkedHashSet<>();
            found.forEach(role -> foundIds.add(role.getId()));
            Long missing = ids.stream().filter(id -> !foundIds.contains(id)).findFirst().orElse(null);
            throw new ResourceNotFoundException("Role", missing);
        }
        return found;
    }

    @Transactional
    public Role create(RoleRequest request) {
        String code = request.code().trim();
        requireCodeAvailable(code, null);

        Role role = new Role(code, request.name().trim(), trimToNull(request.description()), false);
        role.setPermissions(resolvePermissions(request.permissions()));
        return repository.save(role);
    }

    @Transactional
    public Role update(Long id, RolePatchRequest request) {
        Role role = get(id);

        if (request.code() != null) {
            String code = request.code().trim();
            if (role.isSystemRole() && !code.equalsIgnoreCase(role.getCode())) {
                // Renaming ADMIN would not remove anyone's access, but it would
                // break every reference to it that is not a foreign key --
                // seed data, deployment scripts, documentation.
                throw new ConflictException("The code of a system role cannot be changed");
            }
            requireCodeAvailable(code, role.getId());
            role.setCode(code);
        }
        if (request.name() != null) {
            role.setName(request.name().trim());
        }
        if (request.description() != null) {
            role.setDescription(trimToNull(request.description()));
        }
        // null means "leave the grants alone"; an empty list means "revoke all
        // of them", which is a legitimate thing to ask for.
        if (request.permissions() != null) {
            role.setPermissions(resolvePermissions(request.permissions()));
            events.publishEvent(new AuthoritiesChanged.ForEveryone());
        }
        return repository.save(role);
    }

    /**
     * Deletes a role.
     *
     * <p>A role that users still hold is refused by the {@code RESTRICT}
     * foreign key on {@code user_roles}, which surfaces as the same 409 a
     * category still in use produces.
     */
    @Transactional
    public Role delete(Long id) {
        Role role = get(id);
        if (role.isSystemRole()) {
            throw new ConflictException(
                    "%s is a system role and cannot be deleted".formatted(role.getCode()));
        }
        repository.delete(role);
        // The RESTRICT foreign key means nobody still held it, so strictly
        // nothing cached can be wrong. Published anyway: the cost is one reload
        // per active account, and an eviction that turns out to be unnecessary
        // is a far better failure than one that turns out to be missing.
        events.publishEvent(new AuthoritiesChanged.ForEveryone());

        // Returned so the controller can echo the deleted row: the data
        // provider parses the DELETE response body.
        return role;
    }

    private Set<Permission> resolvePermissions(List<PermissionRef> refs) {
        List<Long> ids = refs.stream().map(PermissionRef::id).toList();
        return new LinkedHashSet<>(permissionService.resolveAll(ids));
    }

    /** Rejects a duplicate code with a message about the field, not the index. */
    private void requireCodeAvailable(String code, Long selfId) {
        repository.findByCodeIgnoreCase(code).ifPresent(existing -> {
            if (!existing.getId().equals(selfId)) {
                throw new ConflictException("A role with the code %s already exists".formatted(code));
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
