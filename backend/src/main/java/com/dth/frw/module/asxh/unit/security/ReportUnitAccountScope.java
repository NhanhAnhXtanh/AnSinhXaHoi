package com.dth.frw.module.asxh.unit.security;

import com.dth.frw.module.security.auth.service.AuthorityCache;
import com.dth.frw.module.security.auth.service.AuthorizationService;
import com.dth.frw.shared.security.CurrentUser;
import java.util.Optional;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * "Tài khoản này là cấp Đơn vị không, đơn vị nào" — câu hỏi mà mọi phạm vi dữ liệu ASXH theo
 * đơn vị (UC-72) đặt ra cho mỗi request.
 *
 * <p>Trả lời từ bộ nhớ đệm quyền ({@link AuthorityCache.Entry#reportUnitId()}), cùng nguồn đã
 * xác thực request vừa rồi, nên <b>không tốn câu SQL nào</b> — đây là ngân sách mà cơ chế phạm vi
 * dòng của base đặt ra. Đổi đơn vị của một tài khoản xoá mục đệm của nó (UserService phát
 * {@code AuthoritiesChanged.ForUser}), nên lần request kế tiếp đã theo đơn vị mới.
 *
 * <h2>Vì sao lấy {@link AuthorizationService} qua {@link ObjectProvider}</h2>
 * Cùng lý do {@code RowLevelPrincipalResolver}: chuỗi dựng bean của xác thực đi qua
 * {@code UserService → ReportUnitService → RowLevelSecurity → (bộ chính sách dòng) → bean này},
 * nên phụ thuộc thẳng {@code AuthorizationService → AuthorityCache → UserService} sẽ thành vòng.
 * Hoãn tới lúc dùng thì vòng chỉ còn là chuyện thứ tự dựng, không phải logic.
 */
@Component
public class ReportUnitAccountScope {

    /**
     * Kết luận cho một tài khoản.
     *
     * @param unrestricted {@code true} = tài khoản Sở / UBND / quản trị: không lọc theo đơn vị
     * @param unitId       đơn vị của tài khoản cấp Đơn vị; {@code null} khi {@code unrestricted}
     *                     hoặc khi không xác định được tài khoản (khi đó từ chối mọi dòng)
     */
    public record Restriction(boolean unrestricted, Long unitId) {

        static final Restriction NONE = new Restriction(true, null);
        static final Restriction DENY_ALL = new Restriction(false, null);

        static Restriction toUnit(Long unitId) {
            return new Restriction(false, unitId);
        }

        /** Tài khoản có đúng đơn vị này trong phạm vi không. */
        public boolean allows(Long rowUnitId) {
            return unrestricted || (unitId != null && unitId.equals(rowUnitId));
        }
    }

    private final ObjectProvider<AuthorizationService> authorization;

    public ReportUnitAccountScope(ObjectProvider<AuthorizationService> authorization) {
        this.authorization = authorization;
    }

    /**
     * Phạm vi của người đang gọi. Không có người gọi (khởi động, việc định kỳ, luồng đăng nhập)
     * thì không lọc — cùng quy ước với {@code RowLevelSecurity.scope}, vốn đã trả toàn bộ trước
     * khi tới đây.
     */
    public Restriction current() {
        return CurrentUser.id().map(this::of).orElse(Restriction.NONE);
    }

    /**
     * Phạm vi của một tài khoản. Tài khoản không còn trong bộ nhớ đệm (đã bị xoá) thì từ chối
     * mọi dòng — đóng khi lỗi, không mở.
     */
    public Restriction of(long userId) {
        Optional<AuthorityCache.Entry> entry = authorization.getObject().entryOf(userId);
        if (entry.isEmpty()) {
            return Restriction.DENY_ALL;
        }
        Long unitId = entry.get().reportUnitId();
        return unitId == null ? Restriction.NONE : Restriction.toUnit(unitId);
    }

    /** Đơn vị của tài khoản, rỗng với tài khoản Sở / UBND. */
    public Optional<Long> unitIdOf(long userId) {
        return authorization.getObject().entryOf(userId).map(AuthorityCache.Entry::reportUnitId);
    }
}
