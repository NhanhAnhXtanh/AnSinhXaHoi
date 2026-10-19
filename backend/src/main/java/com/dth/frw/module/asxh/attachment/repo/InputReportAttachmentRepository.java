package com.dth.frw.module.asxh.attachment.repo;

import com.dth.frw.domain.asxh.attachment.InputReportAttachment;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.shared.data.SecuredRepository;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Giấy tờ đính kèm phiếu. Mọi đọc đều theo {@code report.id} — người gọi đã kiểm phiếu thuộc tầm
 * nhìn của mình qua {@code InputReportService.get}, nên lọc theo phiếu vừa là phạm vi vừa chặn lộ
 * file của phiếu khác.
 */
public interface InputReportAttachmentRepository extends SecuredRepository<InputReportAttachment, Long> {

    /**
     * Khoá ghi dòng phiếu tới hết giao dịch và đọc lại trạng thái MỚI NHẤT — cùng khoá với nộp
     * phiếu. Phiếu controller đưa vào được nạp ở giao dịch đọc trước đó, trạng thái có thể đã cũ
     * (phiếu vừa được nộp ở tab khác); tải / gỡ file, tích xác nhận phải kiểm trên bản đã khoá.
     *
     * <p>Khai ở đây chứ không gọi {@code InputReportService}: slice phiếu gọi sang slice này lúc nộp,
     * gọi ngược lại sẽ thành vòng phụ thuộc. Chỉ khoá phiếu mà người gọi đã kiểm phạm vi.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from InputReport r where r.id = :reportId")
    Optional<InputReport> lockReport(@Param("reportId") Long reportId);

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
