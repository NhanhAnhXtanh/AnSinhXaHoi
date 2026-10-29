package com.dth.frw.module.asxh.inputreport.service;

import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.ReportStatus;
import com.dth.frw.module.asxh.inputreport.repo.InputReportRepository;
import com.dth.frw.module.asxh.unit.security.ReportUnitAccountScope;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khoá phiếu đã duyệt / huỷ phiếu (UC-47, chỉ qua REST, không có nút trên giao diện) — port
 * {@code lockReport} / {@code cancelReport} của {@code QtInputReportTransitionService} bản Jmix.
 *
 * <p>Tách khỏi {@link InputReportService} thành lớp riêng (thêm file, không sửa máy trạng thái
 * chính). Cả hai trạng thái đích là trạng thái kết thúc (BR-47.1).
 *
 * <p>Số liệu đã lưu: phiếu khoá SAU khi duyệt vẫn được tổng hợp (có {@code approvedAt}, BR-47.2);
 * phiếu huỷ chưa từng được duyệt nên không có số liệu hiệu lực nào phải gỡ.
 */
@Service
public class InputReportClosureService {

    private final InputReportRepository repository;
    private final ReportUnitAccountScope accountScope;

    public InputReportClosureService(InputReportRepository repository, ReportUnitAccountScope accountScope) {
        this.repository = repository;
        this.accountScope = accountScope;
    }

    /** APPROVED → LOCKED. */
    @Transactional
    public InputReport lock(Long id) {
        // Tài khoản cấp Sở (UC-47) — đọc phiếu không qua phạm vi dòng nên phải chặn cấp tài khoản.
        InputReportService.requireProvinceAccount(accountScope, "khoá");
        InputReport report = repository.findForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("InputReport", id));
        if (report.getStatus() != ReportStatus.APPROVED) {
            throw new ConflictException("Chỉ khoá được phiếu đã phê duyệt.");
        }
        report.setStatus(ReportStatus.LOCKED);
        return repository.persist(report);
    }

    /** DRAFT / RETURNED → CANCELLED. */
    @Transactional
    public InputReport cancel(Long id) {
        InputReportService.requireProvinceAccount(accountScope, "huỷ");
        InputReport report = repository.findForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("InputReport", id));
        if (!report.getStatus().isEditable()) {
            throw new ConflictException("Chỉ huỷ được phiếu đang nhập liệu hoặc bị trả lại.");
        }
        report.setStatus(ReportStatus.CANCELLED);
        return repository.persist(report);
    }
}
