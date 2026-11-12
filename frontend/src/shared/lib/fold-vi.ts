/**
 * Chữ để SO SÁNH khi tìm kiếm: bỏ dấu, đ → d, hạ chữ thường — gõ "quy iii" vẫn ra "Quý III",
 * "mo coi" ra "mồ côi", "an loc" ra "An Lộc". Cả hai vế (từ khoá và chữ trong danh sách) đều
 * phải qua hàm này.
 */
export function foldVi(text: string | null | undefined): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

/** `haystack` có chứa `needle` không, bỏ qua dấu và chữ hoa / thường; `needle` trống thì luôn đúng. */
export function includesFolded(haystack: string | null | undefined, needle: string): boolean {
  const key = foldVi(needle);
  return key === "" || foldVi(haystack).includes(key);
}
