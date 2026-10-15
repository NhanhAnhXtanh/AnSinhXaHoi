package com.dth.frw.module.catalog.department.repo;

import com.dth.frw.domain.catalog.department.Department;
import com.dth.frw.shared.data.SecuredRepository;
import java.util.Optional;

/**
 * A {@link SecuredRepository}, so {@code findById}, {@code findAll()} and
 * {@code findAllById} are not here to be called by mistake.
 */
public interface DepartmentRepository extends SecuredRepository<Department, Long> {

    /**
     * Backs the duplicate-code check, scoped the way the unique constraint is.
     *
     * <p>A department code is unique within its organization rather than
     * globally, so the organization has to be part of the question — asking by
     * code alone would refuse a {@code SALES} in the second company because the
     * first one already has one.
     *
     * <p><b>Deliberately not row-level scoped</b>, for the same reason as
     * {@code OrganizationRepository.findByCodeIgnoreCase}: a uniqueness check
     * that cannot see the rows it is checking against is not a uniqueness check.
     * It is scoped by the organization, which is the boundary that actually
     * matters here.
     */
    Optional<Department> findByOrganizationIdAndCodeIgnoreCase(Long organizationId, String code);
}
