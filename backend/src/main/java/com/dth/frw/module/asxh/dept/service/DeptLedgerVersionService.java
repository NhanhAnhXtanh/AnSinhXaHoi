package com.dth.frw.module.asxh.dept.service;

import com.dth.frw.domain.asxh.dept.DeptLedgerYear;
import com.dth.frw.module.asxh.dept.repo.DeptLedgerYearRepository;
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

    public DeptLedgerVersionService(DeptLedgerYearRepository repository) {
        this.repository = repository;
    }

    /** Phiên bản mới nhất của năm; 0 = chưa có kỳ nào lưu số liệu. */
    @Transactional(readOnly = true)
    public int currentVersion(int year) {
        return repository.findByYear(year).map(DeptLedgerYear::getCurrentVersion).orElse(0);
    }

    /** Cấp phiên bản kế tiếp của năm (khoá dòng của năm tới hết giao dịch). */
    @Transactional
    public int nextVersion(int year) {
        DeptLedgerYear row = lockYear(year);
        row.setCurrentVersion(row.getCurrentVersion() + 1);
        repository.save(row);
        return row.getCurrentVersion();
    }

    /** Khoá dòng của năm (tạo nếu chưa có) tới hết giao dịch và trả nó. */
    @Transactional
    public DeptLedgerYear lockYear(int year) {
        repository.ensureYear(year);
        return repository.lockByYear(year).orElseThrow(() -> new IllegalStateException(
                "Không tạo được bộ đếm phiên bản số liệu năm " + year + "."));
    }
}
