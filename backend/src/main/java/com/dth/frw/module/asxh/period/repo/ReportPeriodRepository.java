package com.dth.frw.module.asxh.period.repo;

import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.shared.data.SecuredRepository;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReportPeriodRepository extends SecuredRepository<ReportPeriod, Long> {

    /** Mọi kỳ của một lịch — dùng khi sinh/cập nhật/xoá lịch. */
    List<ReportPeriod> findByCalendarId(Long calendarId);

    /** Số kỳ của một lịch. */
    long countByCalendarId(Long calendarId);

    /** Kỳ theo trạng thái — job tự chuyển trạng thái theo ngày. */
    List<ReportPeriod> findByStatusIn(Collection<PeriodStatus> statuses);

    /**
     * Kỳ có khoảng số liệu giao với {@code [from, to]} (đóng hai đầu), trừ một kỳ.
     * Phục vụ luật khoá cả kỳ khi trùng thời gian với kỳ đã mở đợt (UC-31).
     */
    @Query("""
            select p from ReportPeriod p
             where p.fromDate <= :to and p.toDate >= :from
               and p.id <> :excludeId
            """)
    List<ReportPeriod> findOverlapping(@Param("from") LocalDate from,
                                       @Param("to") LocalDate to,
                                       @Param("excludeId") Long excludeId);

    /** Số kỳ mỗi lịch, gom một câu cho cả trang danh sách lịch. */
    @Query("""
            select p.calendar.id, count(p) from ReportPeriod p
             where p.calendar.id in :calendarIds
             group by p.calendar.id
            """)
    List<Object[]> countByCalendarIds(@Param("calendarIds") Collection<Long> calendarIds);
}
