package com.dth.frw.module.asxh.ledger.api.dto;

import com.dth.frw.domain.asxh.ledger.LedgerSource;
import com.dth.frw.domain.asxh.ledger.LedgerWriteAudit;
import java.time.Instant;

/** Một dòng nhật ký ghi số liệu của phiếu (để hộp "Lịch sử thao tác" tra lý do duyệt thất bại). */
public record LedgerWriteAuditResponse(
        Long id,
        Long reportId,
        Long sheetId,
        Long templateId,
        Long templateVersionId,
        LedgerSource source,
        LedgerWriteAudit.Result result,
        int linesAdded,
        int linesUpdated,
        int linesRemoved,
        String failReason,
        Instant operatedAt,
        String operatedBy) {

    public static LedgerWriteAuditResponse from(LedgerWriteAudit audit) {
        return new LedgerWriteAuditResponse(
                audit.getId(),
                audit.getReportId(),
                audit.getSheetId(),
                audit.getTemplateId(),
                audit.getTemplateVersionId(),
                audit.getSource(),
                audit.getResult(),
                audit.getLinesAdded(),
                audit.getLinesUpdated(),
                audit.getLinesRemoved(),
                audit.getFailReason(),
                audit.getOperatedAt(),
                audit.getOperatedBy());
    }
}
