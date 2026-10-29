package com.dth.frw.module.asxh.ledger.service;

import com.dth.frw.domain.asxh.report.InputReport;
import com.dth.frw.domain.asxh.report.InputReportSheet;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Điểm móc DUY NHẤT mà {@code InputReportService} gọi sang phần số liệu đã lưu / kiểm tra phía
 * máy chủ — gom về một bean để slice phiếu chỉ thêm một phụ thuộc.
 *
 * <p>Phụ thuộc chỉ đi một chiều (phiếu → đây). Không lớp nào ở đây được gọi ngược
 * {@code InputReportService}: phiếu và tờ biểu do người gọi truyền vào.
 *
 * <p>Không có móc cho TRẢ LẠI / HUỶ: hiệu lực số liệu suy từ trạng thái phiếu (xem
 * {@code EffectiveLedgerQuery}), nên phiếu chuyển {@code SUPERSEDED} / {@code CANCELLED} là số liệu
 * (nếu có, vd từ nạp BHXH) tự hết hiệu lực. Phiếu chờ duyệt chưa bao giờ có số liệu do script ghi.
 */
@Service
public class InputReportWorkflowHooks {

    private final ReportSubmitValidationService submitValidation;
    private final LedgerWriteService ledgerWriter;

    public InputReportWorkflowHooks(ReportSubmitValidationService submitValidation, LedgerWriteService ledgerWriter) {
        this.submitValidation = submitValidation;
        this.ledgerWriter = ledgerWriter;
    }

    /**
     * Gọi trong {@code submit}, SAU kiểm "đủ biểu", TRƯỚC khi đổi trạng thái: xác nhận Kho bạc rồi
     * chạy lại {@code validate} của mẫu. Ném {@code ConflictException} (409) nếu chưa đạt.
     */
    @Transactional
    public void beforeSubmit(InputReport report, List<InputReportSheet> sheets) {
        submitValidation.assertReadyForSubmit(report, sheets);
    }

    /**
     * Gọi trong {@code approve}, SAU kiểm trạng thái, TRƯỚC khi đổi sang {@code APPROVED}, trong
     * CÙNG giao dịch: chống cộng đôi, chạy {@code getInputData} từng biểu và lưu số liệu. Ném
     * {@code ConflictException} (409) — giao dịch duyệt huỷ, phiếu vẫn chờ duyệt.
     */
    @Transactional
    public void onApprove(InputReport report, List<InputReportSheet> sheets) {
        ledgerWriter.writeOnApprove(report, sheets);
    }
}
