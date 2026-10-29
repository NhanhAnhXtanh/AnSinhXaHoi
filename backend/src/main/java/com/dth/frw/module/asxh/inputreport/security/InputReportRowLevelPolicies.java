package com.dth.frw.module.asxh.inputreport.security;

import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.Publication;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.module.asxh.unit.security.ReportUnitAccountScope;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.security.rowlevel.DefaultScope;
import com.dth.frw.shared.security.rowlevel.FieldDescriptor;
import com.dth.frw.shared.security.rowlevel.RowLevelPolicySet;
import com.dth.frw.shared.security.rowlevel.Tri;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;

/**
 * Phạm vi dữ liệu của {@code input_reports} (UC-72): tài khoản cấp Đơn vị chỉ thấy, chỉ ghi
 * phiếu của chính đơn vị mình; tài khoản Sở / UBND / quản trị không bị lọc theo đơn vị
 * (BR-72.1) — việc họ được làm gì do mã quyền của vai trò quyết định.
 *
 * <h2>Vì sao là FILTER thiết kế sẵn, không phải SCOPE theo vai trò</h2>
 * <ul>
 *   <li>Cấp tài khoản suy ra từ <b>đơn vị gắn với tài khoản</b>, không từ vai trò (BR-69.1:
 *       "mọi kiểm quyền nghiệp vụ dùng cấp này"). Một SCOPE gắn vai trò
 *       {@code ORGANIZATION_REPORTER} sẽ bị nới rộng ngay khi ai đó gán thêm cho tài khoản đơn
 *       vị một vai trò khác (SCOPE hợp bằng OR) — đúng lỗ UC-71 1a của bản Jmix. FILTER thì
 *       luôn AND, không vai trò nào thoát được.</li>
 *   <li>Đây là bất biến nghiệp vụ nên nằm trong code (review, test, triển khai cùng code), không
 *       phải dòng dữ liệu mà quản trị viên tắt được trên màn "Phạm vi dữ liệu".</li>
 * </ul>
 * Điều kiện của FILTER phụ thuộc người gọi: tài khoản không gắn đơn vị thì đúng với mọi dòng;
 * tài khoản gắn đơn vị thì {@code unit.id = đơn vị của tài khoản}. Chỉ đúng đơn vị, không gồm
 * đơn vị con — như {@code OfficerOrgRowLevelRole} của bản Jmix.
 *
 * <p>{@link DefaultScope#FULL}: không vai trò nào khai SCOPE, nên ai đã qua {@code @PreAuthorize}
 * thì thấy mọi phiếu trừ khi FILTER trên thu hẹp.
 *
 * <p>Ghi phiếu đơn vị khác: dòng nằm ngoài phạm vi ĐỌC nên không tìm thấy, trả 404 "Không tìm
 * thấy phiếu nhập" — đúng nguyên tắc của base (id của dòng không được thấy không phân biệt được
 * với id không tồn tại). Đường duyệt / trả lại của Sở đọc phiếu không qua phạm vi
 * ({@code findForUpdate}) và được chặn bằng mã quyền {@code input_reports:approve}.
 */
@Component
public class InputReportRowLevelPolicies implements RowLevelPolicySet<InputReport> {

    static final String FILTER_NAME = "Tài khoản đơn vị chỉ thấy phiếu của đơn vị mình (UC-72)";

    private final ReportUnitAccountScope accountScope;

    public InputReportRowLevelPolicies(ReportUnitAccountScope accountScope) {
        this.accountScope = accountScope;
    }

    @Override
    public String resource() {
        return "input_reports";
    }

    @Override
    public Class<InputReport> entityClass() {
        return InputReport.class;
    }

    @Override
    public DefaultScope defaultScope() {
        return DefaultScope.FULL;
    }

    /** Trường chính sách soạn tay được nhắc tới (ví dụ SCOPE {@code unit.id = user.reportUnitId}). */
    @Override
    public List<FieldDescriptor> fields() {
        return List.of(
                FieldDescriptor.id("id"),
                FieldDescriptor.reference("unit", ReportUnit.class),
                FieldDescriptor.reference("period", ReportPeriod.class),
                FieldDescriptor.reference("publication", Publication.class),
                FieldDescriptor.column("status", ReportStatus.class, false),
                FieldDescriptor.column("createdAt", Instant.class, false));
    }

    @Override
    public Set<String> notCheckSafe() {
        return Set.of("id", "createdAt");
    }

    @Override
    public List<DesignTimeFilter<InputReport>> filters() {
        return List.of(
                filter(Action.READ),
                filter(Action.WRITE),
                filter(Action.DELETE));
    }

    private DesignTimeFilter<InputReport> filter(Action action) {
        Specification<InputReport> using = (root, query, cb) -> {
            ReportUnitAccountScope.Restriction restriction = accountScope.current();
            if (restriction.unrestricted()) {
                return cb.conjunction();
            }
            if (restriction.unitId() == null) {
                return cb.disjunction();
            }
            // unit là khoá ngoại NOT NULL: so thẳng cột khoá ngoại.
            return cb.equal(root.get("unit").get("id"), restriction.unitId());
        };
        return new DesignTimeFilter<>(action, FILTER_NAME, using,
                (report, principal) -> {
                    ReportUnitAccountScope.Restriction restriction = accountScope.of(principal.userId());
                    if (restriction.unrestricted()) {
                        return Tri.TRUE;
                    }
                    if (report.getUnit() == null || report.getUnit().getId() == null) {
                        return Tri.UNKNOWN;
                    }
                    return restriction.allows(report.getUnit().getId()) ? Tri.TRUE : Tri.FALSE;
                });
    }
}
