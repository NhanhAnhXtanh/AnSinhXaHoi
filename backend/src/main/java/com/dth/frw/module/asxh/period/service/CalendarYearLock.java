package com.dth.frw.module.asxh.period.service;

import com.dth.frw.module.asxh.dept.service.DeptYearLockService;
import com.dth.frw.shared.exception.ConflictException;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lịch báo cáo của một năm chốt cùng báo cáo năm (UC-60): khi Sở đã nộp báo cáo năm lên UBND
 * (đang chờ duyệt) hoặc UBND đã duyệt, lịch năm đó — loại kỳ, hạn nộp chung, hạn nộp từng kỳ,
 * xoá lịch — không đổi được nữa. UBND trả lại / mở lại thì năm mở và lịch sửa được như cũ.
 *
 * <p>Chỉ ĐỌC trạng thái khoá năm của {@link DeptYearLockService}; không tự khoá hay mở năm.
 */
@Component
public class CalendarYearLock {

    private final DeptYearLockService yearLockService;

    public CalendarYearLock(DeptYearLockService yearLockService) {
        this.yearLockService = yearLockService;
    }

    /** Câu cho người dùng vì sao lịch năm {@code year} không sửa được; rỗng = sửa được. */
    @Transactional(readOnly = true)
    public Optional<String> reason(int year) {
        return switch (yearLockService.state(year)) {
            case OPEN -> Optional.empty();
            case SUBMITTED -> Optional.of("Báo cáo năm " + year + " đã nộp UBND nên lịch báo cáo năm "
                    + year + " không sửa được nữa.");
            case APPROVED -> Optional.of("UBND đã duyệt báo cáo năm " + year + " nên lịch báo cáo năm "
                    + year + " đã chốt, không sửa được nữa.");
        };
    }

    /** @throws ConflictException lịch năm {@code year} đã chốt cùng báo cáo năm */
    @Transactional(readOnly = true)
    public void assertEditable(int year) {
        reason(year).ifPresent(message -> {
            throw new ConflictException(message);
        });
    }
}
