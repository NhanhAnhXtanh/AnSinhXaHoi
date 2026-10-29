package com.dth.frw.module.asxh.dept;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.domain.asxh.dept.DeptYearLockState;
import com.dth.frw.module.asxh.dept.service.DeptLedgerVersionService;
import com.dth.frw.module.asxh.dept.service.DeptYearLockService;
import com.dth.frw.shared.exception.ConflictException;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bộ đếm phiên bản / khoá năm của số liệu Sở trên CSDL thật: lượt ghi số liệu đã ĐỌC dòng của năm ở bước
 * kiểm khoá đầu giao dịch, rồi một giao dịch khác commit (nộp báo cáo năm, lưu kỳ khác) trước khi lượt này
 * giữ khoá. Mô phỏng phần "giao dịch khác" bằng câu SQL thuần — đổi dòng trong CSDL mà không qua
 * persistence context, đúng như một giao dịch khác.
 *
 * <p>Trước khi sửa: truy vấn {@code for update} trả lại thực thể cũ trong persistence context nên
 * {@code nextVersion} cấp lại số đã dùng và ghi đè {@code lock_state} về OPEN (mất khoá năm đã nộp UBND).
 *
 * <p>{@code @Transactional}: mọi thay đổi quay lui khi test xong. Năm 2187 không đụng dữ liệu nào khác.
 */
@SpringBootTest
@Transactional
class DeptYearCounterLockTest {

    private static final int YEAR = 2187;

    @Autowired
    private DeptLedgerVersionService versionService;

    @Autowired
    private DeptYearLockService yearLockService;

    @Autowired
    private EntityManager entityManager;

    /** Tạo dòng của năm và nạp nó vào persistence context như bước kiểm khoá đầu một lượt ghi. */
    private void loadYearRow() {
        versionService.lockYear(YEAR);
        entityManager.flush();
        assertTrue(yearLockService.lockReason(YEAR).isEmpty(), "năm thử ban đầu đang mở");
    }

    private void updateInDatabase(String setClause) {
        entityManager.createNativeQuery("update asxh_dept_ledger_years set " + setClause + " where year_no = :year")
                .setParameter("year", YEAR)
                .executeUpdate();
    }

    @Test
    @DisplayName("Cấp phiên bản đọc số đã commit, không cấp lại số một lượt khác vừa dùng")
    void nextVersionReadsCommittedCounter() {
        loadYearRow();
        updateInDatabase("current_version = 7");

        assertEquals(8, versionService.nextVersion(YEAR));
        entityManager.flush();
        Number stored = (Number) entityManager
                .createNativeQuery("select current_version from asxh_dept_ledger_years where year_no = :year")
                .setParameter("year", YEAR)
                .getSingleResult();
        assertEquals(8, stored.intValue());
    }

    @Test
    @DisplayName("Năm vừa nộp UBND trong lúc lượt ghi đang chạy: từ chối ghi, khoá năm giữ nguyên")
    void nextVersionRefusesYearLockedMeanwhile() {
        loadYearRow();
        updateInDatabase("lock_state = 'SUBMITTED', lock_note = 'Báo cáo năm 2187 đã nộp UBND.'");

        ConflictException error = assertThrows(ConflictException.class, () -> versionService.nextVersion(YEAR));
        assertEquals("Báo cáo năm 2187 đã nộp UBND.", error.getMessage());

        Object[] row = (Object[]) entityManager
                .createNativeQuery("select lock_state, current_version from asxh_dept_ledger_years where year_no = :year")
                .setParameter("year", YEAR)
                .getSingleResult();
        assertEquals("SUBMITTED", row[0], "khoá năm không bị ghi đè về OPEN");
        assertEquals(0, ((Number) row[1]).intValue(), "không tiêu phiên bản");
    }

    @Test
    @DisplayName("Khoá / mở khoá năm giữ số phiên bản mà lượt khác vừa commit")
    void lockKeepsCommittedCounter() {
        loadYearRow();
        updateInDatabase("current_version = 4");

        yearLockService.lock(YEAR, DeptYearLockState.SUBMITTED, null);
        entityManager.flush();

        Number stored = (Number) entityManager
                .createNativeQuery("select current_version from asxh_dept_ledger_years where year_no = :year")
                .setParameter("year", YEAR)
                .getSingleResult();
        assertEquals(4, stored.intValue(), "nộp báo cáo năm không kéo bộ đếm về số cũ");
        assertTrue(yearLockService.lockReason(YEAR).isPresent());
    }
}
