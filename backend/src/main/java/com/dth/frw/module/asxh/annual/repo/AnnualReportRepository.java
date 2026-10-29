package com.dth.frw.module.asxh.annual.repo;

import com.dth.frw.domain.asxh.annual.AnnualReport;
import com.dth.frw.domain.asxh.annual.AnnualReportStatus;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Phiếu năm. Không phải tài nguyên phân quyền theo dòng: ai có {@code annual_reports:read} thấy mọi
 * phiếu năm đã nộp (Sở và UBND dùng chung — UC-61).
 */
public interface AnnualReportRepository extends JpaRepository<AnnualReport, Long> {

    /** Mọi phiếu năm, năm mới trước rồi phiếu mới trước. */
    @Query("select r from AnnualReport r order by r.reportYear desc, r.revisionNo desc")
    List<AnnualReport> findAllOrdered();

    /** Mọi phiếu của một năm, phiếu mới trước. */
    @Query("select r from AnnualReport r where r.reportYear = :year order by r.revisionNo desc")
    List<AnnualReport> findByYear(@Param("year") int year);

    /** Phiếu còn hiệu lực của năm (đang chờ / đã duyệt), mới nhất trước. */
    @Query("select r from AnnualReport r where r.reportYear = :year and r.status in :statuses "
            + "order by r.revisionNo desc")
    List<AnnualReport> findByYearAndStatusIn(@Param("year") int year,
                                             @Param("statuses") Collection<AnnualReportStatus> statuses);

    @Query("select coalesce(max(r.revisionNo), 0) from AnnualReport r where r.reportYear = :year")
    int maxRevision(@Param("year") int year);

    /** Khoá dòng phiếu tới hết giao dịch — bấm duyệt hai lần thì lần sau chờ rồi rớt ở kiểm trạng thái. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from AnnualReport r where r.id = :id")
    Optional<AnnualReport> findForUpdate(@Param("id") Long id);
}
