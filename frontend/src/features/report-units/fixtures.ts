// Dữ liệu mẫu — thay bằng API khi backend có.

/** Loại đơn vị (UC-01). Giá trị nội bộ, không hiện lên giao diện — nhãn ở UNIT_TYPE_LABELS. */
export type UnitType = "tinh" | "so" | "truong" | "xa" | "khac";

export const UNIT_TYPES: UnitType[] = ["tinh", "so", "truong", "xa", "khac"];

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  tinh: "Tỉnh",
  so: "Sở",
  truong: "Trường",
  xa: "Xã",
  khac: "Khác",
};

export type UnitAccount = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  active: boolean;
};

export type ReportUnit = {
  id: string;
  /** Mã quan hệ ngân sách — nhập tay, không đổi sau khi lưu. Chỉ hiện ở form. */
  code: string;
  name: string;
  type: UnitType;
  parentId: string | null;
  active: boolean;
  receivesReports: boolean;
  accounts: UnitAccount[];
};

type Seed = {
  id: string;
  code: string;
  name: string;
  type: UnitType;
  parentId: string | null;
  active?: boolean;
  receivesReports?: boolean;
  /** Phần tên đăng nhập, ví dụ "baovinh" → ubnd.baovinh, ketoan.baovinh. */
  slug: string;
  accounts: number;
};

const PEOPLE = [
  "Nguyễn Văn Hải",
  "Trần Thị Mai",
  "Lê Văn Phúc",
  "Phạm Thị Hương",
  "Võ Minh Tâm",
];

const PREFIXES = ["ubnd", "ketoan", "vanthu", "chuyenvien", "thuquy"];

/** Họ tên "Nguyễn Văn Hải" → "hai.nv". */
function emailLocal(fullName: string): string {
  const plain = fullName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .split(" ");
  const last = plain[plain.length - 1];
  const initials = plain
    .slice(0, -1)
    .map((p) => p[0])
    .join("");
  return `${last}.${initials}`;
}

function makeAccounts(seed: Seed): UnitAccount[] {
  return Array.from({ length: seed.accounts }, (_, i) => {
    const fullName = PEOPLE[i % PEOPLE.length];
    return {
      id: `${seed.id}-tk${i + 1}`,
      username: `${PREFIXES[i % PREFIXES.length]}.${seed.slug}`,
      fullName,
      email: `${emailLocal(fullName)}@${seed.slug}.dongnai.gov.vn`,
      active: seed.active !== false,
    };
  });
}

const SEEDS: Seed[] = [
  { id: "dv-stc", code: "1000001", name: "Sở Tài chính Đồng Nai", type: "so", parentId: null, slug: "stc", accounts: 3 },

  { id: "dv-bienhoa", code: "1051001", name: "UBND TP. Biên Hoà", type: "khac", parentId: "dv-stc", slug: "bienhoa", accounts: 2 },
  { id: "dv-tranbien", code: "1051101", name: "UBND phường Trấn Biên", type: "xa", parentId: "dv-bienhoa", slug: "tranbien", accounts: 1 },
  { id: "dv-buulong", code: "1051102", name: "UBND phường Bửu Long", type: "xa", parentId: "dv-bienhoa", slug: "buulong", accounts: 1 },
  { id: "dv-hoaan", code: "1051103", name: "UBND phường Hoá An", type: "xa", parentId: "dv-bienhoa", slug: "hoaan", accounts: 1 },
  { id: "dv-tanphong", code: "1051104", name: "UBND phường Tân Phong", type: "xa", parentId: "dv-bienhoa", active: false, slug: "tanphong", accounts: 0 },

  { id: "dv-longkhanh", code: "1052001", name: "UBND TP. Long Khánh", type: "khac", parentId: "dv-stc", slug: "longkhanh", accounts: 2 },
  { id: "dv-baovinh", code: "1052345", name: "UBND phường Bảo Vinh", type: "xa", parentId: "dv-longkhanh", slug: "baovinh", accounts: 2 },
  { id: "dv-xuanan", code: "1052346", name: "UBND phường Xuân An", type: "xa", parentId: "dv-longkhanh", slug: "xuanan", accounts: 1 },

  { id: "dv-trangbom", code: "1053001", name: "UBND huyện Trảng Bom", type: "khac", parentId: "dv-stc", slug: "trangbom", accounts: 2 },
  { id: "dv-bauham", code: "1053101", name: "UBND xã Bàu Hàm", type: "xa", parentId: "dv-trangbom", slug: "bauham", accounts: 1 },
  { id: "dv-honai3", code: "1053102", name: "UBND xã Hố Nai 3", type: "xa", parentId: "dv-trangbom", slug: "honai3", accounts: 1 },
  { id: "dv-tttrangbom", code: "1053103", name: "UBND thị trấn Trảng Bom", type: "xa", parentId: "dv-trangbom", slug: "tttrangbom", accounts: 1 },

  { id: "dv-longthanh", code: "1054001", name: "UBND huyện Long Thành", type: "khac", parentId: "dv-stc", slug: "longthanh", accounts: 1 },
  { id: "dv-anphuoc", code: "1054101", name: "UBND xã An Phước", type: "xa", parentId: "dv-longthanh", slug: "anphuoc", accounts: 1 },

  { id: "dv-nhontrach", code: "1055001", name: "UBND huyện Nhơn Trạch", type: "khac", parentId: "dv-stc", slug: "nhontrach", accounts: 1 },
  { id: "dv-longtan", code: "1055101", name: "UBND xã Long Tân", type: "xa", parentId: "dv-nhontrach", slug: "longtan", accounts: 1 },

  { id: "dv-thongnhat", code: "1056001", name: "UBND huyện Thống Nhất", type: "khac", parentId: "dv-stc", slug: "thongnhat", accounts: 1 },
  { id: "dv-giatan1", code: "1056101", name: "UBND xã Gia Tân 1", type: "xa", parentId: "dv-thongnhat", slug: "giatan1", accounts: 1 },

  { id: "dv-bhxh", code: "1060001", name: "Bảo hiểm xã hội Đồng Nai", type: "so", parentId: "dv-stc", slug: "bhxh", accounts: 1 },
  { id: "dv-thptlvt", code: "1070001", name: "Trường THPT Chuyên Lương Thế Vinh", type: "truong", parentId: "dv-stc", slug: "thptlvt", accounts: 1 },
  { id: "dv-mnhoasen", code: "1070002", name: "Trường Mầm non Hoa Sen", type: "truong", parentId: "dv-stc", active: false, receivesReports: false, slug: "mnhoasen", accounts: 0 },
];

export const REPORT_UNITS: ReportUnit[] = SEEDS.map((seed) => ({
  id: seed.id,
  code: seed.code,
  name: seed.name,
  type: seed.type,
  parentId: seed.parentId,
  active: seed.active !== false,
  receivesReports: seed.receivesReports !== false,
  accounts: makeAccounts(seed),
}));
