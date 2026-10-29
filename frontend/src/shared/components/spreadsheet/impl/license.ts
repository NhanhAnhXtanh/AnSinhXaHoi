import * as GC from "@mescius/spread-sheets";

// Giấy phép SpreadJS — bê từ bản Jmix (core/spread/license.ts).
//
// Phải gán TRƯỚC khi tạo Workbook/Designer đầu tiên: gán sau khi đã có instance
// thì instance đó vẫn chạy chế độ dùng thử. Vì vậy hai module nặng (workbook,
// designer) gọi `applySpreadLicense()` ở cấp module, ngay sau phần import.
//
// Khoá đọc từ biến môi trường build (`frontend/.env`), không bao giờ ghi cứng.
// Rỗng = bản dùng thử: có chữ mờ và sheet "Evaluation Version" (bị bỏ khi lưu/xuất).
//
// Khoá Designer chỉ gán được khi namespace `GC.Spread.Sheets.Designer` đã tồn tại,
// tức `@mescius/spread-sheets-designer` đã được import TRƯỚC lời gọi. Nếu màn bảng
// tính thường mở trước rồi mới tới Designer, lần gọi thứ hai (từ module designer)
// sẽ gán nốt khoá Designer.

let sheetsKeyApplied = false;
let designerKeyApplied = false;

export function applySpreadLicense(): void {
  const sheetsKey = import.meta.env.VITE_SPREADJS_LICENSE_KEY;
  if (!sheetsKeyApplied && sheetsKey) {
    GC.Spread.Sheets.LicenseKey = sheetsKey;
  }
  sheetsKeyApplied = true;

  const designerKey = import.meta.env.VITE_SPREADJS_DESIGNER_LICENSE_KEY;
  if (designerKeyApplied || !designerKey) return;
  const designerNamespace = (
    GC.Spread.Sheets as unknown as { Designer?: { LicenseKey: string } }
  ).Designer;
  if (designerNamespace) {
    designerNamespace.LicenseKey = designerKey;
    designerKeyApplied = true;
  }
}
