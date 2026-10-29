package com.dth.frw.module.asxh.setup.repo;

import com.dth.frw.domain.asxh.report.PeriodAssignment;
import com.dth.frw.shared.data.SecuredRepository;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * A {@link SecuredRepository}. Các truy vấn khai thêm phục vụ luật nghiệp vụ của ma trận và
 * phải thấy mọi thiết lập của kỳ, không phụ thuộc người gọi: mở đợt hay áp dụng sang kỳ khác
 * mà bỏ sót ô ngoài tầm nhìn của người bấm là phát / sao chép thiếu.
 *
 * <p>Truy vấn chống chồng kỳ THEO ĐƠN VỊ ({@code findOverlapping}) đã bỏ cùng luật BR-22.2 —
 * trùng thời gian giờ chỉ khoá cả kỳ (xem {@code PeriodSetupLockService}).
 */
public interface PeriodAssignmentRepository extends SecuredRepository<PeriodAssignment, Long> {

    @Query("select a from PeriodAssignment a where a.period.id = :periodId order by a.id")
    List<PeriodAssignment> findByPeriodId(@Param("periodId") Long periodId);

    @Query("select count(a) from PeriodAssignment a where a.period.id = :periodId")
    long countByPeriodId(@Param("periodId") Long periodId);
}
