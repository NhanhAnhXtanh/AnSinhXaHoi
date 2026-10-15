package com.dth.frw.module.security.rowlevel.repo;

import com.dth.frw.domain.security.rowlevel.RowLevelPolicyAudit;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Append-only. Nothing here updates or deletes, and nothing reads it back yet.
 *
 * <p>The trail is written on every change so that it exists when it is needed —
 * which, for an audit trail, is always after the fact. Exposing it through the
 * API is a screen nobody has asked for; the table is queryable in the meantime,
 * and the rows outlive the policies they describe.
 */
public interface RowLevelPolicyAuditRepository extends JpaRepository<RowLevelPolicyAudit, Long> {
}
