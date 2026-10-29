package com.dth.frw.module.asxh.unit.security;

import com.dth.frw.shared.security.rowlevel.RowLevelContextProvider;
import com.dth.frw.shared.security.rowlevel.RowLevelPrincipal;
import org.springframework.stereotype.Component;

/**
 * Khoá ngữ cảnh {@code user.reportUnitId} cho chính sách phạm vi dữ liệu soạn trên màn
 * "Phạm vi dữ liệu" — ví dụ một SCOPE {@code unit.id = user.reportUnitId} cho một vai trò mới.
 *
 * <p>Đúng cơ chế mở rộng của base: một bean tự khai một khoá, bộ máy không đổi. Không truy vấn
 * CSDL — đọc từ bộ nhớ đệm quyền qua {@link ReportUnitAccountScope}. Tài khoản Sở / UBND trả
 * {@code null}, khiến lá điều kiện thành UNKNOWN và dòng bị từ chối (đúng ngữ nghĩa ba giá trị).
 */
@Component
public class ReportUnitContextProvider implements RowLevelContextProvider {

    private final ReportUnitAccountScope scope;

    public ReportUnitContextProvider(ReportUnitAccountScope scope) {
        this.scope = scope;
    }

    @Override
    public String key() {
        return "user.reportUnitId";
    }

    @Override
    public Class<?> type() {
        return Long.class;
    }

    @Override
    public Object resolve(RowLevelPrincipal principal) {
        return scope.unitIdOf(principal.userId()).orElse(null);
    }
}
