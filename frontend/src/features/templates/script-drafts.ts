import type { ApiTemplateScript, TemplateScriptPayload } from "./types";

/**
 * Bản soạn tại chỗ của một kịch bản trong màn Thiết kế mẫu — như `DraftScript` của
 * `ScriptEditorPanel.tsx` bản Jmix. `uid` ổn định suốt vòng đời bản soạn (đặt tên mô hình Monaco
 * và khoá "đang chạy"); KHÔNG dùng chỉ số trong danh sách vì đổi khi chuyển lên / xuống / xoá.
 */
export type DraftScript = {
  uid: string;
  /** null = kịch bản mới, chưa lưu. */
  id: number | null;
  name: string;
  description: string;
  /** null = mọi biểu; BM-xxxxxx = riêng biểu đó. */
  sheetCode: string | null;
  code: string;
  enabled: boolean;
};

let draftSeq = 0;

/** uid cho bản soạn mới (phía trình duyệt). */
export function nextDraftUid(): string {
  draftSeq += 1;
  return `moi-${draftSeq}`;
}

export function toDraft(script: ApiTemplateScript): DraftScript {
  return {
    uid: `kb-${script.id}`,
    id: script.id,
    name: script.name,
    description: script.description ?? "",
    sheetCode: script.sheetCode,
    code: script.code,
    enabled: script.enabled,
  };
}

/** Danh sách gửi lên khi lưu — thứ tự chạy là thứ tự trong danh sách. */
export function toPayloads(
  drafts: readonly DraftScript[],
  declaredHooksOf: (code: string) => string | null
): TemplateScriptPayload[] {
  return drafts.map((draft, index) => ({
    id: draft.id,
    sheetCode: draft.sheetCode,
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    code: draft.code,
    declaredHooks: declaredHooksOf(draft.code),
    displayOrder: index,
    enabled: draft.enabled,
  }));
}

/**
 * Sau khi lưu: ghép id máy chủ vào bản soạn, giữ nguyên uid (kịch bản đang chạy không bị mất dấu).
 * Kịch bản đã có id ghép theo id; kịch bản mới ghép lần lượt theo thứ tự với các id mới.
 */
export function applySavedIds(
  drafts: readonly DraftScript[],
  saved: readonly ApiTemplateScript[]
): DraftScript[] {
  const known = new Map(drafts.filter((d) => d.id != null).map((d) => [d.id, d]));
  const fresh = drafts.filter((d) => d.id == null);
  return saved.map((script) => {
    const same = known.get(script.id) ?? fresh.shift();
    const draft = toDraft(script);
    return same ? { ...draft, uid: same.uid } : draft;
  });
}

/**
 * Kịch bản đang bật dạng mảng JSON — đúng dạng máy chủ gửi cho màn nhập liệu, để "Xem trước"
 * chạy y như thật.
 */
export function runtimeScriptText(drafts: readonly DraftScript[]): string {
  const records = drafts
    .filter((draft) => draft.enabled)
    .map((draft, index) => ({
      id: draft.uid,
      name: draft.name,
      sheetCode: null,
      code: draft.code,
      displayOrder: index,
      enabled: true,
    }));
  return records.length === 0 ? "" : JSON.stringify(records);
}

/**
 * Khung cho kịch bản mới — theo `NEW_SCRIPT_TEMPLATE` của bản Jmix. Khác bản Jmix: hàm
 * getSummaryData để ở dạng chú thích, vì kịch bản có hàm đó được coi là "kịch bản tổng hợp" (Sở sửa
 * số trực tiếp được) — để mặc định thì mọi biểu mới đều thành biểu Sở sửa được với số rỗng.
 */
export function newScriptTemplate(sheetName: string): string {
  return `// Kịch bản của biểu — một bộ kịch bản dùng cho mọi màn (nhập liệu, duyệt, tổng hợp).
// Mỗi màn chỉ gọi hàm của nó; hàm dùng chung (beforeEdit…) phân biệt màn qua ctx.mode:
// 'input' = đơn vị nhập liệu, 'summary-edit' = Sở sửa số tổng hợp. Xoá hàm không dùng.
const SHEET = ${JSON.stringify(sheetName)}; // tên trang trong bảng tính
return defineScript({
  onLoad(ctx) {
    if (ctx.mode !== 'input') return; // chỉ khoá ở màn nhập
    // Mở / khoá ô nhập: ctx.cell.lock(SHEET, dòng, cột, false);
  },

  // Ô nào sửa được — trả false để chặn, không trả gì = không ý kiến.
  beforeEdit(ctx, cell) {
    if (ctx.mode === 'summary-edit') {
      // return cell.sheetName === SHEET && cell.col === 2;
      return;
    }
  },

  // Chạy khi đơn vị bấm NỘP phiếu. Mục mức 'ERROR' chặn nộp.
  validate(ctx) {
    const issues = [];
    // if (ctx.cell.get(SHEET, 9, 2) == null) issues.push({ severity: 'ERROR', code: 'BAT_BUOC', message: '...' });
    return issues;
  },

  // Chạy trên MÁY CHỦ khi Sở DUYỆT phiếu: đọc ô, TRẢ VỀ các dòng số liệu.
  getInputData(ctx) {
    return [
      // { indicatorCode: '1A.01', indicatorName: 'Chỉ tiêu',
      //   quantity: ctx.cell.get(SHEET, 9, 2), amount: ctx.cell.get(SHEET, 9, 3) },
    ];
  },

  // Bỏ chú thích nếu Sở được sửa số tổng hợp của biểu này (chạy trên MÁY CHỦ khi Sở lưu):
  // getSummaryData(ctx) {
  //   return [{ organizationCode: '', indicatorCode: '1A.01', indicatorName: 'Chỉ tiêu',
  //             quantity: ctx.cell.get(SHEET, 9, 2), amount: ctx.cell.get(SHEET, 9, 3) }];
  // },
});
`;
}
