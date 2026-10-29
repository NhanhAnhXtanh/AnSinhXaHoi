package com.dth.frw.module.asxh.setup.repo;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.report.PublicationKind;
import com.dth.frw.domain.asxh.report.PublicationStatus;
import com.dth.frw.shared.data.SecuredRepository;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PublicationRepository extends SecuredRepository<Publication, Long> {

    /** Số thứ tự đợt lớn nhất của kỳ (0 khi chưa có đợt nào, kể cả đợt đã thu hồi). */
    @Query("select coalesce(max(p.publicationNo), 0) from Publication p where p.period.id = :periodId")
    int maxPublicationNo(@Param("periodId") Long periodId);

    @Query("select count(p) from Publication p where p.period.id = :periodId "
            + "and p.kind = :kind and p.status = :status")
    long countByPeriodKindStatus(@Param("periodId") Long periodId,
                                 @Param("kind") PublicationKind kind,
                                 @Param("status") PublicationStatus status);

    @Query("select p from Publication p where p.period.id = :periodId and p.status = :status order by p.publicationNo")
    List<Publication> findByPeriodAndStatus(@Param("periodId") Long periodId,
                                            @Param("status") PublicationStatus status);

    /**
     * Các kỳ ĐÃ MỞ ĐỢT (còn đợt hiệu lực và kỳ ở một trong {@code openedStatuses}) có thời gian
     * giao với {@code [fromDate, toDate]} — nền của luật khoá cả kỳ (UC-31). Người gọi tự loại
     * chính kỳ đang xét.
     */
    @Query("select distinct pr from Publication p join p.period pr where p.status = :active "
            + "and pr.status in :openedStatuses and pr.fromDate <= :toDate and pr.toDate >= :fromDate")
    List<ReportPeriod> findOpenedPeriodsOverlapping(@Param("active") PublicationStatus active,
                                                    @Param("openedStatuses") Collection<PeriodStatus> openedStatuses,
                                                    @Param("fromDate") LocalDate fromDate,
                                                    @Param("toDate") LocalDate toDate);
}
