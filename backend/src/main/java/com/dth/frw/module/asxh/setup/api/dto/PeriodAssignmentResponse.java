package com.dth.frw.module.asxh.setup.api.dto;

import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.PeriodAssignment;
import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import java.time.Instant;

/**
 * Wire shape của một ô ma trận thiết lập. Màn ma trận đọc {@code unit.id} × {@code template.id}
 * để tích ô; tên lồng sẵn để không phải gọi thêm.
 */
public record PeriodAssignmentResponse(
        Long id,
        PeriodSummary period,
        UnitSummary unit,
        TemplateSummary template,
        String createdBy,
        Instant createdAt) {

    public record PeriodSummary(Long id, String name) {
        static PeriodSummary from(ReportPeriod period) {
            return new PeriodSummary(period.getId(), period.getName());
        }
    }

    public record UnitSummary(Long id, String budgetCode, String name) {
        static UnitSummary from(ReportUnit unit) {
            return new UnitSummary(unit.getId(), unit.getBudgetCode(), unit.getName());
        }
    }

    /** {@code locked} = biểu đang khoá để sửa — màn ma trận ẩn cột và ô của biểu đó. */
    public record TemplateSummary(Long id, String shortName, String name, boolean locked) {
        static TemplateSummary from(Template template) {
            return new TemplateSummary(template.getId(), template.getShortName(), template.getName(),
                    template.isLocked());
        }
    }

    public static PeriodAssignmentResponse from(PeriodAssignment assignment) {
        return new PeriodAssignmentResponse(
                assignment.getId(),
                PeriodSummary.from(assignment.getPeriod()),
                UnitSummary.from(assignment.getUnit()),
                TemplateSummary.from(assignment.getTemplate()),
                assignment.getCreatedBy(),
                assignment.getCreatedAt());
    }
}
