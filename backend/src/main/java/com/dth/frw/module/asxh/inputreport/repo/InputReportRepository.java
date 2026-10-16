package com.dth.frw.module.asxh.inputreport.repo;

import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.shared.data.SecuredRepository;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * A {@link SecuredRepository}: mọi đọc thông thường đi qua {@code Specification} (đã gập
 * phạm vi dòng). Các phương thức khai thêm dưới đây là đường của nghiệp vụ kỳ/đợt — chạy
 * trong service đã kiểm quyền, và phải thấy MỌI phiếu của kỳ bất kể người gọi là ai (chốt đợt
 * mà bỏ sót phiếu ngoài tầm nhìn của người bấm là chốt sai).
 */
public interface InputReportRepository extends SecuredRepository<InputReport, Long> {

    /**
     * Khoá ghi dòng phiếu tới hết giao dịch — cho duyệt / trả lại (UC-41, UC-42): bấm đúp
     * hoặc hai tab cùng xử lý thì lần thứ hai chờ rồi rớt ở kiểm tra trạng thái, thay vì sinh
     * hai phiên bản.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from InputReport r where r.id = :id")
    Optional<InputReport> findForUpdate(@Param("id") Long id);

    /** Phiếu của kỳ ở các trạng thái cho trước, cũ trước. */
    @Query("select r from InputReport r where r.period.id = :periodId and r.status in :statuses "
            + "order by r.createdAt asc, r.id asc")
    List<InputReport> findByPeriodAndStatuses(@Param("periodId") Long periodId,
                                              @Param("statuses") Collection<ReportStatus> statuses);

    /** Tên đơn vị có phiếu ở trạng thái cho trước trong kỳ — cho câu báo "còn N đơn vị chờ duyệt". */
    @Query("select distinct u.name from InputReport r join r.unit u where r.period.id = :periodId "
            + "and r.status = :status order by u.name")
    List<String> findUnitNamesByPeriodAndStatus(@Param("periodId") Long periodId,
                                                @Param("status") ReportStatus status);

    /** Chốt đợt: DRAFT / RETURNED → LOCKED trong một câu lệnh. */
    @Modifying(flushAutomatically = true)
    @Query("update InputReport r set r.status = :target, r.updatedAt = :now "
            + "where r.period.id = :periodId and r.status in :from")
    int updateStatusForPeriod(@Param("periodId") Long periodId,
                              @Param("from") Collection<ReportStatus> from,
                              @Param("target") ReportStatus target,
                              @Param("now") Instant now);

    /** Thu hồi kỳ, bước 1: gỡ chuỗi phiên bản để xoá được cả chuỗi trong một câu lệnh. */
    @Modifying(flushAutomatically = true)
    @Query("update InputReport r set r.previousRevision = null where r.period.id = :periodId")
    int detachRevisionsForPeriod(@Param("periodId") Long periodId);

    /** Thu hồi kỳ, bước 3 (sau khi đã xoá tờ biểu): xoá mọi phiếu của kỳ, mọi trạng thái. */
    @Modifying(flushAutomatically = true)
    @Query("delete from InputReport r where r.period.id = :periodId")
    int deleteForPeriod(@Param("periodId") Long periodId);
}
