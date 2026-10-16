package com.dth.frw.domain.asxh.ledger;

/** Nguồn của một lần ghi số liệu đã lưu. */
public enum LedgerSource {

    /** Hook {@code getInputData} của mẫu chạy khi Sở phê duyệt phiếu (UC-41). */
    SCRIPT,

    /** Nạp từ dữ liệu BHXH đã chuẩn hoá qua REST (UC-49). */
    BHXH_IMPORT
}
