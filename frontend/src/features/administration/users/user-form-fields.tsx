/**
 * Phần dùng chung của form tạo và form sửa người dùng.
 *
 * Figma tách họ tên thành "Họ và tên đệm" và "Tên", còn API chỉ có một ô
 * `fullName`. Hai ô chỉ sống trên form: khi mở form sửa, `fullName` được tách
 * ở khoảng trắng cuối cùng; khi lưu, hai ô được ghép lại bằng một khoảng trắng.
 */

export function RequiredMark() {
  return (
    <span aria-hidden className="text-destructive">
      *
    </span>
  );
}

export function joinFullName(familyName: string | undefined, givenName: string | undefined) {
  return [familyName?.trim(), givenName?.trim()].filter(Boolean).join(" ");
}

export function splitFullName(fullName: string | null | undefined): {
  familyName: string;
  givenName: string;
} {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { familyName: "", givenName: "" };
  return {
    familyName: parts.slice(0, -1).join(" "),
    givenName: parts[parts.length - 1],
  };
}

/** Cùng luật API kiểm (`UserRequest`), để lỗi hiện ngay chứ không chờ máy chủ. */
export const USER_FIELD_RULES = {
  username: {
    required: "Vui lòng nhập tên đăng nhập.",
    minLength: { value: 3, message: "Tên đăng nhập cần ít nhất 3 ký tự." },
    pattern: {
      value: /^[a-zA-Z0-9._-]+$/,
      message:
        "Chỉ dùng chữ không dấu, chữ số, dấu chấm, gạch dưới hoặc gạch ngang.",
    },
  },
  email: {
    required: "Vui lòng nhập thư điện tử.",
    pattern: {
      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: "Thư điện tử chưa đúng dạng, ví dụ: an.nv@dongnai.gov.vn",
    },
  },
};
