// Mỗi spec giữ riêng một năm báo cáo: dọn đúng năm đó trước khi chạy và sau khi xong,
// nên các spec độc lập, chạy lẻ hay chạy lại đều được. Năm phải nằm trong khoảng máy chủ
// nhận (hiện tại −10 … +20) và không trùng năm có số liệu seed / test backend (2025–2026).
// Báo cáo năm (spec d) khoá CẢ năm sau khi nộp — lý do chính để không dùng chung năm.
export const E2E_YEARS = {
  setupAndOpen: 2041,
  unitInputSubmit: 2042,
  reviewLedgerSummary: 2043,
  annualUbnd: 2044,
} as const;
