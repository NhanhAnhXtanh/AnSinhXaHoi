package com.dth.frw.module.catalog.organization.repo;

import com.dth.frw.domain.catalog.organization.Organization;
import com.dth.frw.shared.data.SecuredRepository;
import java.util.Optional;

/**
 * A {@link SecuredRepository}, so {@code findById}, {@code findAll()} and
 * {@code findAllById} are not here to be called by mistake.
 */
public interface OrganizationRepository extends SecuredRepository<Organization, Long> {

    /**
     * Backs the duplicate-code check. Case-insensitive, because {@code hq} and
     * {@code HQ} are the same handle to everyone except the index.
     *
     * <p><b>Deliberately unscoped, and this is the reason a new method on a
     * secured repository is meant to be visible in review.</b> A code is unique
     * across the whole table, so the question "is this code taken" has to see
     * rows the caller cannot. Scoping it would let two organizations be created
     * with the same code by two people who cannot see each other's — and the
     * unique index would then refuse the second save with a message about a
     * constraint instead of about the field.
     *
     * <p>It leaks exactly one bit (that some code is in use) to somebody
     * entitled to create an organization, which is the smaller of the two
     * problems by a wide margin.
     */
    Optional<Organization> findByCodeIgnoreCase(String code);
}
