package com.dth.frw.module.asxh.period.repo;

import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.shared.data.SecuredRepository;
import java.util.Optional;

public interface ReportCalendarRepository extends SecuredRepository<ReportCalendar, Long> {

    /** Kiểm tra "mỗi năm một lịch" (BR-06.1) trước khi để unique index báo lỗi. */
    Optional<ReportCalendar> findByYear(Integer year);
}
