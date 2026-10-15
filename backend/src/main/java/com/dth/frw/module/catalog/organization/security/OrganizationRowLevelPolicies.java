package com.dth.frw.module.catalog.organization.security;

import com.dth.frw.domain.catalog.organization.Organization;
import com.dth.frw.domain.catalog.organization.OrganizationStatus;
import com.dth.frw.shared.security.rowlevel.DefaultScope;
import com.dth.frw.shared.security.rowlevel.FieldDescriptor;
import com.dth.frw.shared.security.rowlevel.RowLevelPolicySet;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * What a row-level policy on {@code organizations} may say.
 *
 * <p>The obvious scope here is "the organization I am in", written as
 * {@code id = user.organizationId} — which is why {@code id} is a policy field
 * rather than merely the primary key. It is the one resource where a scope on
 * the identifier is the natural rule rather than a sign that something has gone
 * wrong.
 *
 * <p>Note what that does <em>not</em> do on its own: narrowing which
 * organizations somebody may read says nothing about which departments or users
 * they may read, because a scope filters the root of the resource being served
 * and does not follow foreign keys. Each of those needs its own policy.
 */
@Component
public class OrganizationRowLevelPolicies implements RowLevelPolicySet<Organization> {

    @Override
    public String resource() {
        return "organizations";
    }

    @Override
    public Class<Organization> entityClass() {
        return Organization.class;
    }

    /**
     * {@code FULL}, like every resource brought under management after it was
     * already running: no scope means not narrowed, so switching this on changes
     * nothing for anyone and no migration has to seed a policy to keep it that
     * way. {@code NONE} is the destination once the coverage grid is clear.
     */
    @Override
    public DefaultScope defaultScope() {
        return DefaultScope.FULL;
    }

    /**
     * {@code description}, {@code email}, {@code phone} and {@code address} are
     * deliberately absent. Free text that people edit is not a security
     * boundary, and a scope written over it breaks the first time somebody
     * corrects a typo.
     */
    @Override
    public List<FieldDescriptor> fields() {
        return List.of(
                FieldDescriptor.id("id"),
                FieldDescriptor.column("code", String.class, false),
                FieldDescriptor.column("name", String.class, false),
                FieldDescriptor.column("status", OrganizationStatus.class, false),
                FieldDescriptor.column("createdAt", Instant.class, false));
    }

    @Override
    public Set<String> notCheckSafe() {
        return Set.of("id", "createdAt", "updatedAt");
    }
}
