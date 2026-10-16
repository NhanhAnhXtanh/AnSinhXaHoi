// Icon cho NÚT TRONG Ô của bảng nhập (cột thao tác biểu nhập hộ: [＋][✕], "＋ Thêm đơn vị")
// — bê từ bản Jmix (core/spread/cellButtonIcons.ts).
//
// Script của biểu nằm trong CSDL và bản mẫu đã ban hành thì không sửa được, nên không
// đổi được caption ở nguồn. Adapter tự nhận ký tự đứng đầu caption rồi thay bằng icon
// SVG (SpreadJS cellButton: imageType = custom + imageSrc); phần chữ còn lại giữ làm caption.
//
// Hình vẽ theo đúng nét của bộ lucide (plus, x, trash-2: 24x24, stroke 2). SpreadJS vẽ
// imageSrc qua <img> nên `currentColor` không dùng được — màu phải ghi trong SVG. Đây là
// cấu hình nội bộ của SpreadJS (canvas không đọc được token CSS).

/** Kích thước icon trong nút (px) — vừa ô cao 20–24px. */
export const CELL_BUTTON_ICON_SIZE = 14;

const ADD_COLOR = "#2563eb";
const DELETE_COLOR = "#dc2626";

function strokeIcon(color: string, body: string): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" ' +
    `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" ` +
    `stroke-linejoin="round">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PLUS_ICON_SRC = strokeIcon(ADD_COLOR, '<path d="M5 12h14"/><path d="M12 5v14"/>');
const CLOSE_ICON_SRC = strokeIcon(DELETE_COLOR, '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');
const TRASH_ICON_SRC = strokeIcon(
  DELETE_COLOR,
  '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>' +
    '<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>' +
    '<line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>'
);

const ICON_BY_GLYPH: ReadonlyMap<string, string> = new Map([
  ["＋", PLUS_ICON_SRC],
  ["+", PLUS_ICON_SRC],
  ["✚", PLUS_ICON_SRC],
  ["✕", CLOSE_ICON_SRC],
  ["✖", CLOSE_ICON_SRC],
  ["✗", CLOSE_ICON_SRC],
  ["×", CLOSE_ICON_SRC],
  ["\u{1F5D1}", TRASH_ICON_SRC],
]);

export interface ResolvedCellButtonIcon {
  imageSrc: string | null;
  caption: string;
}

/** Bóc ký tự biểu tượng ở đầu caption thành icon. Caption thuần chữ giữ nguyên. */
export function resolveCellButtonIcon(caption: string): ResolvedCellButtonIcon {
  const text = String(caption ?? "").trim();
  if (text === "") return { imageSrc: null, caption: "" };
  // Ký tự đầu có thể là surrogate pair nên lấy theo code point.
  const first = Array.from(text)[0];
  const icon = ICON_BY_GLYPH.get(first);
  if (!icon) return { imageSrc: null, caption: text };
  // Bóc luôn biến thể emoji (U+FE0F) đi kèm.
  return {
    imageSrc: icon,
    caption: text.slice(first.length).replace(/^️/, "").trim(),
  };
}
