package com.dth.frw.module.asxh.inputreport.security;

import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import com.dth.frw.domain.asxh.report.SheetCompletion;
import com.dth.frw.module.asxh.unit.security.ReportUnitAccountScope;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.security.rowlevel.DefaultScope;
import com.dth.frw.shared.security.rowlevel.FieldDescriptor;
import com.dth.frw.shared.security.rowlevel.RowLevelPolicySet;
import com.dth.frw.shared.security.rowlevel.Tri;
import java.util.List;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;

/**
 * Phạm vi dữ liệu của tờ biểu ({@code input_report_sheets}): cùng luật với phiếu
 * ({@link InputReportRowLevelPolicies}) — tài khoản cấp Đơn vị chỉ đọc, lưu số liệu, đánh dấu
 * tờ biểu thuộc phiếu của đơn vị mình (UC-72 bước 1–2).
 *
 * <p>Tờ biểu có đường riêng theo id ({@code PUT /api/input_report_sheets/{id}}…), nên phải có
 * phạm vi riêng: chỉ lọc phiếu thì cán bộ đơn vị A đoán được id tờ biểu của đơn vị B vẫn lưu đè
 * được số liệu. Điều kiện đi hai bước {@code report.unit} nên là FILTER thiết kế sẵn — từ vựng
 * của chính sách soạn tay chỉ cho một bước tham chiếu.
 */
@Component
public class InputReportSheetRowLevelPolicies implements RowLevelPolicySet<InputReportSheet> {

    static final String FILTER_NAME = "Tài khoản đơn vị chỉ thấy biểu trong phiếu của đơn vị mình (UC-72)";

    private final ReportUnitAccountScope accountScope;

    public InputReportSheetRowLevelPolicies(ReportUnitAccountScope accountScope) {
        this.accountScope = accountScope;
    }

    @Override
    public String resource() {
        return "input_report_sheets";
    }

    @Override
    public Class<InputReportSheet> entityClass() {
        return InputReportSheet.class;
    }

    @Override
    public DefaultScope defaultScope() {
        return DefaultScope.FULL;
    }

    @Override
    public List<FieldDescriptor> fields() {
        return List.of(
                FieldDescriptor.id("id"),
                FieldDescriptor.reference("report", InputReport.class),
                FieldDescriptor.column("completion", SheetCompletion.class, false));
    }

    @Override
    public Set<String> notCheckSafe() {
        return Set.of("id");
    }

    @Override
    public List<DesignTimeFilter<InputReportSheet>> filters() {
        return List.of(
                filter(Action.READ),
                filter(Action.WRITE),
                filter(Action.DELETE));
    }

    private DesignTimeFilter<InputReportSheet> filter(Action action) {
        Specification<InputReportSheet> using = (root, query, cb) -> {
            ReportUnitAccountScope.Restriction restriction = accountScope.current();
            if (restriction.unrestricted()) {
                return cb.conjunction();
            }
            if (restriction.unitId() == null) {
                return cb.disjunction();
            }
            // report là to-one NOT NULL: join trong không nhân dòng, tổng số trang vẫn đúng.
            return cb.equal(root.get("report").get("unit").get("id"), restriction.unitId());
        };
        return new DesignTimeFilter<>(action, FILTER_NAME, using,
                (sheet, principal) -> {
                    ReportUnitAccountScope.Restriction restriction = accountScope.of(principal.userId());
                    if (restriction.unrestricted()) {
                        return Tri.TRUE;
                    }
                    InputReport report = sheet.getReport();
                    if (report == null || report.getUnit() == null) {
                        return Tri.UNKNOWN;
                    }
                    return restriction.allows(report.getUnit().getId()) ? Tri.TRUE : Tri.FALSE;
                });
    }
}
