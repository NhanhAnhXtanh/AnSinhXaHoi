package com.dth.frw.module.asxh.setup.service;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportCalendar;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.PeriodAssignment;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import java.time.LocalDate;
import java.util.List;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Dựng thực thể trong bộ nhớ cho test luật thiết lập kỳ — không cần cơ sở dữ liệu. Id gán bằng
 * phản chiếu vì thực thể chỉ có id do cơ sở dữ liệu sinh.
 */
final class SetupTestData {

    static final ReportCalendar CALENDAR_2026 =
            new ReportCalendar(2026, 15, List.of(PeriodKind.THANG, PeriodKind.QUY, PeriodKind.SAU_THANG, PeriodKind.NAM));

    private SetupTestData() {
    }

    static ReportPeriod period(long id, String name, PeriodKind kind, String from, String to, PeriodStatus status) {
        LocalDate fromDate = LocalDate.parse(from);
        LocalDate toDate = LocalDate.parse(to);
        ReportPeriod period = new ReportPeriod(
                CALENDAR_2026, kind, 1, "K" + id, name, fromDate, toDate, fromDate, toDate.plusDays(15));
        ReflectionTestUtils.setField(period, "id", id);
        period.setStatus(status);
        return period;
    }

    static ReportUnit unit(long id, String name) {
        ReportUnit unit = new ReportUnit("DV" + id, name, null, null, null);
        ReflectionTestUtils.setField(unit, "id", id);
        return unit;
    }

    static Template template(long id, String shortName) {
        Template template = new Template(null, "BM-" + id, shortName, "Biểu " + shortName, TemplateKind.CHI_TIET, (int) id);
        ReflectionTestUtils.setField(template, "id", id);
        return template;
    }

    static PeriodAssignment cell(long id, ReportPeriod period, ReportUnit unit, Template template) {
        PeriodAssignment assignment = new PeriodAssignment(period, unit, template, "tester");
        ReflectionTestUtils.setField(assignment, "id", id);
        return assignment;
    }
}
