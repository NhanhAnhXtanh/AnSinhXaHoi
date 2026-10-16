package com.dth.frw.module.asxh.ledger.api.dto;

/** Kết quả một lần nạp: số dòng thêm / sửa / xoá của tờ biểu. */
public record LedgerImportResponse(Long reportId, Long sheetId, Long templateId, int added, int updated, int removed) {
}
