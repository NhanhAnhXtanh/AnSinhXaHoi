package com.dth.frw.module.asxh.dept.service;

import com.dth.frw.domain.asxh.dept.DeptChange;
import com.dth.frw.domain.asxh.dept.DeptChangeAction;
import com.dth.frw.domain.asxh.dept.DeptLedgerYear;
import com.dth.frw.domain.asxh.dept.DeptYearLockState;
import com.dth.frw.module.asxh.dept.repo.DeptChangeRepository;
import com.dth.frw.module.asxh.dept.repo.DeptLedgerYearRepository;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.security.CurrentUser;
import java.time.Instant;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khoá số liệu Sở theo báo cáo năm (UC-60) — CỔNG GHI cho agent BÁO CÁO NĂM.
 *
 * <p>Giống phiếu đơn vị: nộp lên là hết sửa, bị trả lại mới sửa tiếp. Báo cáo năm gọi:
 * <ul>
 *   <li>nộp → {@code lock(year, SUBMITTED, null)} (cùng giao dịch nộp; ghim
 *       {@code DeptYearDataQuery.currentVersion(year)} vào phiếu năm);</li>
 *   <li>UBND duyệt → {@code lock(year, APPROVED, null)};</li>
 *   <li>UBND trả lại / mở lại → {@code unlock(year, null)};</li>
 *   <li>mỗi mốc → {@code recordYearEvent(...)} để hiện trong lịch sử năm.</li>
 * </ul>
 * Số liệu kỳ chỉ đọc {@link #lockReason} / {@link #assertOpen} để chặn sửa.
 *
 * <p>{@code lock} khoá dòng của năm ({@code select … for update}) — cùng ổ khoá mà mọi lượt ghi số
 * liệu Sở đi qua, nên một lượt "Kiểm tra &amp; hoàn tất" đang chạy không lọt qua lúc năm vừa bị nộp.
 */
@Service
public class DeptYearLockService {

    private final DeptLedgerYearRepository yearRepository;
    private final DeptChangeRepository changeRepository;
    private final DeptLedgerVersionService versionService;

    public DeptYearLockService(DeptLedgerYearRepository yearRepository,
                               DeptChangeRepository changeRepository,
                               DeptLedgerVersionService versionService) {
        this.yearRepository = yearRepository;
        this.changeRepository = changeRepository;
        this.versionService = versionService;
    }

    /** Trạng thái khoá của năm ({@link DeptYearLockState#OPEN} khi năm chưa có dòng). */
    @Transactional(readOnly = true)
    public DeptYearLockState state(int year) {
        return yearRepository.findByYear(year).map(DeptLedgerYear::getLockState).orElse(DeptYearLockState.OPEN);
    }

    /** Câu cho người dùng vì sao năm đang khoá; rỗng = sửa được. */
    @Transactional(readOnly = true)
    public Optional<String> lockReason(int year) {
        return yearRepository.findByYear(year).flatMap(row -> reasonOf(row, year));
    }

    /** @throws ConflictException năm đang khoá */
    @Transactional(readOnly = true)
    public void assertOpen(int year) {
        lockReason(year).ifPresent(reason -> {
            throw new ConflictException(reason);
        });
    }

    /**
     * Khoá năm (agent BÁO CÁO NĂM gọi khi nộp / UBND duyệt).
     *
     * @param note câu riêng hiện cho người dùng; {@code null} = câu mặc định theo trạng thái
     */
    @Transactional
    public void lock(int year, DeptYearLockState state, String note) {
        if (state == null || state == DeptYearLockState.OPEN) {
            unlock(year, note);
            return;
        }
        DeptLedgerYear row = versionService.lockYear(year);
        row.setLockState(state);
        row.setLockNote(note);
        row.setLockedAt(Instant.now());
        row.setLockedBy(CurrentUser.username().orElse(null));
        yearRepository.save(row);
    }

    /** Mở khoá năm (agent BÁO CÁO NĂM gọi khi UBND trả lại / mở lại). */
    @Transactional
    public void unlock(int year, String note) {
        DeptLedgerYear row = versionService.lockYear(year);
        row.setLockState(DeptYearLockState.OPEN);
        row.setLockNote(note);
        row.setLockedAt(null);
        row.setLockedBy(null);
        yearRepository.save(row);
    }

    /**
     * Ghi một mốc của báo cáo năm vào lịch sử số liệu Sở của năm.
     *
     * @param annualRef id phiếu năm của slice báo cáo năm
     * @param versionNo phiên bản số liệu năm đã ghim ({@code null} nếu không áp dụng)
     */
    @Transactional
    public DeptChange recordYearEvent(int year, Long annualRef, DeptChangeAction action, Integer versionNo,
                                      String note) {
        DeptChange change = DeptChange.forYear(year, annualRef, action, versionNo, note,
                CurrentUser.username().orElse("hệ thống"), Instant.now());
        return changeRepository.save(change);
    }

    static Optional<String> reasonOf(DeptLedgerYear row, int year) {
        if (row.getLockState() == null || row.getLockState() == DeptYearLockState.OPEN) {
            return Optional.empty();
        }
        if (row.getLockNote() != null && !row.getLockNote().isBlank()) {
            return Optional.of(row.getLockNote());
        }
        return Optional.of(row.getLockState() == DeptYearLockState.APPROVED
                ? "UBND đã duyệt báo cáo năm " + year + " nên số liệu đã chốt, không sửa được. Muốn sửa thì UBND phải mở lại."
                : "Báo cáo năm " + year + " đã nộp UBND và đang chờ duyệt nên chưa sửa được số liệu.");
    }
}
