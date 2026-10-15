package com.dth.frw.module.catalog.department.security;

import com.dth.frw.domain.catalog.department.Department;
import com.dth.frw.domain.catalog.department.DepartmentStatus;
import com.dth.frw.domain.catalog.organization.Organization;
import com.dth.frw.shared.security.rowlevel.DefaultScope;
import com.dth.frw.shared.security.rowlevel.FieldDescriptor;
import com.dth.frw.shared.security.rowlevel.RowLevelPolicySet;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * What a row-level policy on {@code departments} may say.
 *
 * <p>The two rules this exists to make expressible are "my own department"
 * ({@code id = user.departmentId}) and "every department in my company"
 * ({@code organization.id = user.organizationId}) — which is why both the
 * identifier and the association are policy fields.
 *
 * <p>The second is the more useful of the two and the one worth understanding:
 * it compiles to an {@code EXISTS} against {@code organizations}, so a
 * department whose foreign key is somehow null is refused rather than admitted.
 * The column is {@code NOT NULL} today, which is exactly why the reference is
 * still declared nullable — a policy that quietly assumes otherwise stops
 * matching the day the column is relaxed.
 */
@Component
public class DepartmentRowLevelPolicies implements RowLevelPolicySet<Department> {

    @Override
    public String resource() {
        return "departments";
    }

    @Override
    public Class<Department> entityClass() {
        return Department.class;
    }

    /** {@code FULL}: a resource already in use, so switching this on is a no-op. */
    @Override
    public DefaultScope defaultScope() {
        return DefaultScope.FULL;
    }

    @Override
    public List<FieldDescriptor> fields() {
        return List.of(
                FieldDescriptor.id("id"),
                FieldDescriptor.column("code", String.class, false),
                FieldDescriptor.column("name", String.class, false),
                FieldDescriptor.column("status", DepartmentStatus.class, false),
                FieldDescriptor.column("createdAt", Instant.class, false),
                FieldDescriptor.reference("organization", Organization.class));
    }

    @Override
    public Set<String> notCheckSafe() {
        return Set.of("id", "createdAt", "updatedAt");
    }
}
