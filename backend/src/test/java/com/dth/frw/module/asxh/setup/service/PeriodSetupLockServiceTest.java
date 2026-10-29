package com.dth.frw.module.asxh.setup.service;

import static com.dth.frw.module.asxh.setup.service.SetupTestData.period;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.asxh.period.PeriodKind;
import com.dth.frw.domain.asxh.period.PeriodStatus;
import com.dth.frw.domain.asxh.period.ReportPeriod;
import com.dth.frw.domain.asxh.report.PublicationStatus;
import com.dth.frw.module.asxh.setup.repo.PublicationRepository;
import com.dth.frw.shared.exception.ConflictException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Luật KHOÁ CẢ KỲ (UC-31, user chốt 16/10): kỳ trùng thời gian với một kỳ KHÁC đã mở đợt thì
 * khoá cho mọi đơn vị — không còn khoá theo từng đơn vị.
 *
 * <p>Kho đợt phát hành được giả lập: nó chỉ trả các kỳ đã mở đợt trong cửa sổ ngày, phần
 * lọc trùng / chọn kỳ gây khoá là việc của service và là thứ được kiểm ở đây.
 */
class PeriodSetupLockServiceTest {

    private final ReportPeriod nam = period(1, "Năm 2026", PeriodKind.NAM, "2026-01-01", "2026-12-31", PeriodStatus.DRAFT);
    private final ReportPeriod sauThangDau =
            period(2, "6 tháng đầu năm 2026", PeriodKind.SAU_THANG, "2026-01-01", "2026-06-30", PeriodStatus.READY);
    private final ReportPeriod quy1 = period(3, "Quý I/2026", PeriodKind.QUY, "2026-01-01", "2026-03-31", PeriodStatus.CLOSED);
    private final ReportPeriod quy3 = period(4, "Quý III/2026", PeriodKind.QUY, "2026-07-01", "2026-09-30", PeriodStatus.OVERDUE);
    private final ReportPeriod thang1 = period(5, "Tháng 1/2026", PeriodKind.THANG, "2026-01-01", "2026-01-31", PeriodStatus.DRAFT);
    private final ReportPeriod thang4 = period(6, "Tháng 4/2026", PeriodKind.THANG, "2026-04-01", "2026-04-30", PeriodStatus.DRAFT);
    private final ReportPeriod thang8 = period(7, "Tháng 8/2026", PeriodKind.THANG, "2026-08-01", "2026-08-31", PeriodStatus.READY);

    private PublicationRepository publications;
    private PeriodSetupLockService service;

    @BeforeEach
    void setUp() {
        publications = mock(PublicationRepository.class);
        when(publications.findOpenedPeriodsOverlapping(
                eq(PublicationStatus.PUBLISHED), anyCollection(), any(), any()))
                .thenReturn(List.of(quy1, quy3));
        service = new PeriodSetupLockService(publications);
    }

    @Test
    @DisplayName("Kỳ trùng thời gian với kỳ đã mở đợt bị khoá cả kỳ; kỳ không trùng vẫn dùng được")
    void locksWholePeriodOnOverlap() {
        Map<Long, PeriodSetupLockService.PeriodLock> locks =
                service.locks(List.of(nam, sauThangDau, thang1, thang4, thang8));

        assertTrue(locks.containsKey(thang1.getId()), "Tháng 1 trùng Quý I đã mở đợt");
        assertTrue(locks.containsKey(sauThangDau.getId()), "6 tháng đầu năm trùng Quý I");
        assertTrue(locks.containsKey(nam.getId()), "Năm trùng mọi kỳ đã mở");
        assertTrue(locks.containsKey(thang8.getId()), "Tháng 8 trùng Quý III");
        assertFalse(locks.containsKey(thang4.getId()), "Tháng 4 không trùng kỳ nào đã mở đợt");
        locks.values().forEach(lock -> assertEquals(PeriodSetupLockService.LockKind.OVERLAP, lock.kind()));
    }

    @Test
    @DisplayName("Lý do nêu kỳ gây khoá, bằng câu tiếng Việt cho người dùng")
    void reasonNamesSourcePeriod() {
        PeriodSetupLockService.PeriodLock lock = service.locks(List.of(thang8)).get(thang8.getId());

        assertEquals(quy3.getId(), lock.sourceId());
        assertEquals("Quý III/2026", lock.sourceName());
        assertEquals("Kỳ Tháng 8/2026 trùng thời gian với Quý III/2026 đã mở đợt nên không thiết lập được. "
                + "Hãy thiết lập ở Quý III/2026.", lock.reason());
    }

    @Test
    @DisplayName("Kỳ gây khoá ưu tiên kỳ còn đang chạy hơn kỳ đã chốt")
    void prefersRunningSourceOverClosed() {
        // Năm 2026 trùng cả Quý I (đã chốt, bắt đầu sớm hơn) và Quý III (quá hạn, còn chạy).
        PeriodSetupLockService.PeriodLock lock = service.locks(List.of(nam)).get(nam.getId());

        assertEquals("Quý III/2026", lock.sourceName());
    }

    @Test
    @DisplayName("Kỳ đã mở đợt không tự bị khoá bởi kỳ khác, cũng không bởi chính nó")
    void openedPeriodIsNotLocked() {
        Map<Long, PeriodSetupLockService.PeriodLock> locks = service.locks(List.of(quy1, quy3));

        assertTrue(locks.isEmpty());
    }

    @Test
    @DisplayName("Không có kỳ nào đã mở đợt thì không khoá gì")
    void nothingOpenedNothingLocked() {
        when(publications.findOpenedPeriodsOverlapping(
                eq(PublicationStatus.PUBLISHED), anyCollection(), any(), any()))
                .thenReturn(List.of());

        assertTrue(service.locks(List.of(nam, thang1, thang8)).isEmpty());
        assertDoesNotThrow(() -> service.assertSetupAllowed(thang1));
    }

    @Test
    @DisplayName("Ghi vào kỳ bị khoá: 409 với đúng câu lý do")
    void assertSetupAllowedThrowsConflict() {
        ConflictException error = assertThrows(ConflictException.class, () -> service.assertSetupAllowed(thang1));

        assertEquals("Kỳ Tháng 1/2026 trùng thời gian với Quý I/2026 đã mở đợt nên không thiết lập được. "
                + "Hãy thiết lập ở Quý I/2026.", error.getMessage());
        assertDoesNotThrow(() -> service.assertSetupAllowed(thang4));
    }

    @Test
    @DisplayName("Hai kỳ chỉ chạm mép ngày vẫn tính là trùng; cách một ngày thì không")
    void overlapIsInclusive() {
        ReportPeriod endsOnStart = period(20, "Kỳ A", PeriodKind.THANG, "2026-03-31", "2026-04-30", PeriodStatus.DRAFT);
        ReportPeriod dayAfter = period(21, "Kỳ B", PeriodKind.THANG, "2026-04-01", "2026-04-30", PeriodStatus.DRAFT);

        assertTrue(PeriodSetupLockService.overlaps(endsOnStart, quy1));
        assertFalse(PeriodSetupLockService.overlaps(dayAfter, quy1));
    }
}
