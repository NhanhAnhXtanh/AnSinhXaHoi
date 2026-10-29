package com.dth.frw.module.asxh.dept.service;

import com.dth.frw.domain.asxh.dept.DeptLedgerYear;
import com.dth.frw.module.asxh.dept.repo.DeptLedgerYearRepository;
import com.dth.frw.shared.exception.ConflictException;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dãy phiên bản số liệu Sở chung của năm (BR-55.2) — port {@code currentLedgerVersion} /
 * {@code nextLedgerVersion} của {@code DeptReportService} bản Jmix.
 *
 * <p>Cấp phiên bản kế tiếp KHOÁ dòng của năm tới hết giao dịch của bên gọi: mọi lượt ghi số liệu Sở
 * trong năm xếp hàng tại đây. Giao dịch huỷ thì số không bị tiêu.
 */
@Service
public class DeptLedgerVersionService {

    private final DeptLedgerYearRepository repository;
    private final EntityManager entityManager;

    public DeptLedgerVersionService(DeptLedgerYearRepository repository, EntityManager entityManager) {
        this.repository = repository;
        this.entityManager = entityManager;
    }

    /** Phiên bản mới nhất của năm; 0 = chưa có kỳ nào lưu số liệu. */
    @Transactional(readOnly = true)
    public int currentVersion(int year) {
        return repository.findByYear(year).map(DeptLedgerYear::getCurrentVersion).orElse(0);
    }

    /**
     * Cấp phiên bản kế tiếp của năm (khoá dòng của năm tới hết giao dịch). Chỉ lượt GHI SỐ LIỆU gọi —
     * nên năm đã nộp / đã duyệt (bị khoá ngay lúc lượt ghi đang chạy, sau bước kiểm đầu) thì từ chối.
     *
     * @throws ConflictException năm đang khoá
     */
    @Transactional
    public int nextVersion(int year) {
        DeptLedgerYear row = lockYear(year);
        DeptYearLockService.reasonOf(row, year).ifPresent(reason -> {
            throw new ConflictException(reason);
        });
        row.setCurrentVersion(row.getCurrentVersion() + 1);
        repository.save(row);
        return row.getCurrentVersion();
    }

    /**
     * Khoá dòng của năm (tạo nếu chưa có) tới hết giao dịch và trả nó với trạng thái ĐỌC SAU KHI GIỮ KHOÁ.
     *
     * <p>Dòng thường đã nằm trong persistence context từ bước kiểm khoá năm đầu giao dịch
     * ({@code DeptYearLockService.lockReason}); truy vấn {@code for update} trả lại đúng thực thể cũ mà
     * KHÔNG nạp lại số. Không đọc lại thì một lượt khác vừa commit (nộp báo cáo năm, lưu số liệu kỳ
     * khác) bị ghi đè: trùng số phiên bản, hoặc khoá năm bị xoá về "mở".
     */
    @Transactional
    public DeptLedgerYear lockYear(int year) {
        repository.ensureYear(year);
        DeptLedgerYear row = repository.lockByYear(year).orElseThrow(() -> new IllegalStateException(
                "Không tạo được bộ đếm phiên bản số liệu năm " + year + "."));
        // Ghi trước thay đổi chưa ghi của chính giao dịch này (refresh bỏ mọi thay đổi trong bộ nhớ).
        entityManager.flush();
        entityManager.refresh(row);
        return row;
    }
}
