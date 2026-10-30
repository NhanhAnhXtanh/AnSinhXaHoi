export type ScriptEditorProps = {
  value: string;
  /** Chỉ gọi khi người dùng sửa — không gọi khi đang ở chế độ chỉ xem. */
  onChange: (value: string) => void;
  /** Phiên bản đã ban hành / đang khoá: xem được, không sửa được. */
  readOnly: boolean;
  /** Câu hiện khi người dùng gõ vào ô đang chỉ xem. */
  readOnlyMessage?: string;
  /** Chữ mờ khi ô trống. */
  placeholder?: string;
  /** Tên đọc cho trình đọc màn hình. */
  ariaLabel: string;
  /** Tên mô hình trong Monaco (giữ lịch sử hoàn tác riêng cho từng ô). */
  path?: string;
  /** Báo vị trí con trỏ (dòng, cột — đếm từ 1) mỗi khi đổi; dùng cho thanh trạng thái. */
  onCursorChange?: (position: { line: number; column: number }) => void;
  /** Cỡ chữ của ô soạn (mặc định 12). */
  fontSize?: number;
  className?: string;
};
