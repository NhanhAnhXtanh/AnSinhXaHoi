package com.dth.frw.module.asxh.ledger.security;

import com.dth.frw.domain.asxh.ledger.LedgerEntry;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.unit.ReportUnit;
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
 * Phạm vi dữ liệu của {@code ledger_entries} (số liệu đã lưu khi duyệt, UC-72): tài khoản cấp Đơn
 * vị chỉ thấy dòng mà <b>đơn vị số liệu HOẶC đơn vị nộp</b> là đơn vị mình (BR-41.3 — biểu nhập hộ
 * 1g có đơn vị số liệu khác đơn vị nộp, cả hai bên đều được xem dòng đó); tài khoản Sở / UBND /
 * quản trị không bị lọc theo đơn vị.
 *
 * <p>Trước đây bảng này không nằm dưới phạm vi dòng nên {@code GET /api/ledger_entries} trả số liệu
 * của MỌI đơn vị cho bất kỳ ai có {@code ledger_entries:read} — cán bộ phường A lọc
 * {@code unit.id=<B>} là đọc được số liệu phường B.
 *
 * <p>Cùng lý do với {@code InputReportRowLevelPolicies}: FILTER thiết kế sẵn (AND, không vai trò
 * nào thoát được), cấp tài khoản suy từ đơn vị gắn với tài khoản chứ không từ vai trò.
 * {@link DefaultScope#FULL}: không vai trò nào khai SCOPE.
 *
 * <p>Đường ghi (duyệt phiếu, nạp BHXH) và chống cộng đôi đọc thẳng kho, không qua phạm vi — chúng
 * phải thấy MỌI dòng bất kể người bấm.
 */
@Component
public class LedgerEntryRowLevelPolicies implements RowLevelPolicySet<LedgerEntry> {

    static final String FILTER_NAME = "Tài khoản đơn vị chỉ thấy số liệu của đơn vị mình (UC-72)";

    private final ReportUnitAccountScope accountScope;

    public LedgerEntryRowLevelPolicies(ReportUnitAccountScope accountScope) {
        this.accountScope = accountScope;
    }

    @Override
    public String resource() {
        return "ledger_entries";
    }

    @Override
    public Class<LedgerEntry> entityClass() {
        return LedgerEntry.class;
    }

    @Override
    public DefaultScope defaultScope() {
        return DefaultScope.FULL;
    }

    @Override
    public List<FieldDescriptor> fields() {
        return List.of(
                FieldDescriptor.id("id"),
                FieldDescriptor.reference("unit", ReportUnit.class),
                FieldDescriptor.reference("submitterUnit", ReportUnit.class),
                FieldDescriptor.reference("report", InputReport.class),
                FieldDescriptor.reference("period", ReportPeriod.class));
    }

    @Override
    public Set<String> notCheckSafe() {
        return Set.of("id");
    }

    @Override
    public List<DesignTimeFilter<LedgerEntry>> filters() {
        return List.of(
                filter(Action.READ),
                filter(Action.WRITE),
                filter(Action.DELETE));
    }

    private DesignTimeFilter<LedgerEntry> filter(Action action) {
        Specification<LedgerEntry> using = (root, query, cb) -> {
            ReportUnitAccountScope.Restriction restriction = accountScope.current();
            if (restriction.unrestricted()) {
                return cb.conjunction();
            }
            if (restriction.unitId() == null) {
                return cb.disjunction();
            }
            // Hai khoá ngoại NOT NULL: so thẳng cột, không nối bảng đơn vị.
            return cb.or(
                    cb.equal(root.get("unit").get("id"), restriction.unitId()),
                    cb.equal(root.get("submitterUnit").get("id"), restriction.unitId()));
        };
        return new DesignTimeFilter<>(action, FILTER_NAME, using,
                (entry, principal) -> {
                    ReportUnitAccountScope.Restriction restriction = accountScope.of(principal.userId());
                    if (restriction.unrestricted()) {
                        return Tri.TRUE;
                    }
                    Long unitId = entry.getUnit() == null ? null : entry.getUnit().getId();
                    Long submitterId = entry.getSubmitterUnit() == null ? null : entry.getSubmitterUnit().getId();
                    if (unitId == null && submitterId == null) {
                        return Tri.UNKNOWN;
                    }
                    return restriction.allows(unitId) || restriction.allows(submitterId) ? Tri.TRUE : Tri.FALSE;
                });
    }
}
