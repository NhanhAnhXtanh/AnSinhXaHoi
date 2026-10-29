package com.dth.frw.module.asxh.ledger.repo;

import com.dth.frw.domain.asxh.ledger.LedgerWriteAudit;
import com.dth.frw.shared.data.SecuredRepository;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LedgerWriteAuditRepository extends SecuredRepository<LedgerWriteAudit, Long> {

    /** Nhật ký ghi của một phiếu, mới trước. */
    @Query("select a from LedgerWriteAudit a where a.reportId = :reportId order by a.operatedAt desc, a.id desc")
    List<LedgerWriteAudit> findByReportId(@Param("reportId") Long reportId);
}
