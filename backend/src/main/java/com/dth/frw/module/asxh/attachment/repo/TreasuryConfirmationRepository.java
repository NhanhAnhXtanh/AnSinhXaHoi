package com.dth.frw.module.asxh.attachment.repo;

import com.dth.frw.domain.asxh.attachment.TreasuryConfirmation;
import com.dth.frw.shared.data.SecuredRepository;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TreasuryConfirmationRepository extends SecuredRepository<TreasuryConfirmation, Long> {

    @Query("select c from TreasuryConfirmation c where c.report.id = :reportId")
    Optional<TreasuryConfirmation> findByReportId(@Param("reportId") Long reportId);
}
