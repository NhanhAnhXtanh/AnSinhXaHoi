package com.dth.frw.module.asxh.ledger.service;

import com.dth.frw.domain.asxh.ledger.LedgerSource;
import com.dth.frw.domain.asxh.ledger.LedgerWriteAudit;
import com.dth.frw.module.asxh.ledger.repo.LedgerWriteAuditRepository;
import com.dth.frw.shared.security.CurrentUser;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Nhật ký ghi số liệu đã lưu (port {@code ScriptWriteAuditService} của bản Jmix).
 *
 * <p><b>FAILED ghi trong giao dịch RIÊNG ({@code REQUIRES_NEW})</b>: khi script lỗi, giao dịch
 * duyệt bị huỷ (phiếu vẫn chờ duyệt) nhưng dòng nhật ký lỗi vẫn phải còn để tra. <b>SUCCESS đi
 * CÙNG giao dịch duyệt</b>: nếu lần duyệt sau đó bị huỷ (biểu thứ hai lỗi), dòng "đã ghi N dòng"
 * phải biến mất cùng — nhật ký không được khẳng định một lần ghi chưa hề xảy ra.
 *
 * <p>Bảng nhật ký không có khoá ngoại nên giao dịch riêng không phải chờ khoá dòng phiếu mà giao
 * dịch duyệt đang giữ.
 */
@Service
public class LedgerAuditService {

    private static final Logger log = LoggerFactory.getLogger(LedgerAuditService.class);

    private static final int FAIL_REASON_MAX_LENGTH = 2000;
    private static final String TRUNCATION_SUFFIX = "…(đã cắt bớt)";

    private final LedgerWriteAuditRepository repository;

    public LedgerAuditService(LedgerWriteAuditRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailed(Long reportId, Long sheetId, Long templateId, Long templateVersionId,
                             LedgerSource source, String failReason) {
        LedgerWriteAudit audit = new LedgerWriteAudit(
                reportId, sheetId, templateId, templateVersionId, source, LedgerWriteAudit.Result.FAILED);
        // fail_reason là varchar(2000): nhiều lỗi nối chuỗi hay ngăn xếp GraalJS dễ dài hơn. Không
        // cắt thì chính câu INSERT nhật ký lỗi và ĐÈ lên lỗi gốc.
        audit.setFailReason(truncate(failReason));
        audit.setOperatedBy(CurrentUser.username().orElse(null));
        repository.persist(audit);
        log.info("Ghi số liệu phiếu {} (tờ biểu {}) thất bại: {}", reportId, sheetId, failReason);
    }

    @Transactional
    public void recordSuccess(Long reportId, Long sheetId, Long templateId, Long templateVersionId,
                              LedgerSource source, int added, int updated, int removed) {
        LedgerWriteAudit audit = new LedgerWriteAudit(
                reportId, sheetId, templateId, templateVersionId, source, LedgerWriteAudit.Result.SUCCESS);
        audit.setLines(added, updated, removed);
        audit.setOperatedBy(CurrentUser.username().orElse(null));
        repository.persist(audit);
    }

    @Transactional(readOnly = true)
    public List<LedgerWriteAudit> forReport(Long reportId) {
        return repository.findByReportId(reportId);
    }

    private static String truncate(String value) {
        if (value == null || value.length() <= FAIL_REASON_MAX_LENGTH) {
            return value;
        }
        return value.substring(0, FAIL_REASON_MAX_LENGTH - TRUNCATION_SUFFIX.length()) + TRUNCATION_SUFFIX;
    }
}
