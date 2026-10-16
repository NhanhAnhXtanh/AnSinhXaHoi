package com.dth.frw.module.asxh.attachment.repo;

import com.dth.frw.domain.asxh.attachment.InputReportAttachment;
import com.dth.frw.shared.data.SecuredRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Giấy tờ đính kèm phiếu. Mọi đọc đều theo {@code report.id} — người gọi đã kiểm phiếu thuộc tầm
 * nhìn của mình qua {@code InputReportService.get}, nên lọc theo phiếu vừa là phạm vi vừa chặn lộ
 * file của phiếu khác.
 */
public interface InputReportAttachmentRepository extends SecuredRepository<InputReportAttachment, Long> {

    /** File còn hiệu lực (chưa gỡ) của phiếu, cũ trước. */
    @Query("select a from InputReportAttachment a where a.report.id = :reportId and a.deletedAt is null "
            + "order by a.createdAt asc, a.id asc")
    List<InputReportAttachment> findActiveByReportId(@Param("reportId") Long reportId);

    @Query("select count(a) from InputReportAttachment a where a.report.id = :reportId and a.deletedAt is null")
    long countActiveByReportId(@Param("reportId") Long reportId);

    @Query("select a from InputReportAttachment a where a.id = :id and a.report.id = :reportId "
            + "and a.deletedAt is null")
    Optional<InputReportAttachment> findActive(@Param("reportId") Long reportId, @Param("id") Long id);
}
