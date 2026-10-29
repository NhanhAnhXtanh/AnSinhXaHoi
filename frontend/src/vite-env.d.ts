/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the REST API. See `src/shared/api/constants.ts`. */
  readonly VITE_API_URL?: string;
  /** Giấy phép SpreadJS (bảng tính). Rỗng = bản dùng thử. */
  readonly VITE_SPREADJS_LICENSE_KEY?: string;
  /** Giấy phép SpreadJS Designer (thiết kế mẫu). Rỗng = bản dùng thử. */
  readonly VITE_SPREADJS_DESIGNER_LICENSE_KEY?: string;
  /** "1" = bật móc cho kiểm thử e2e (chỉ bản build của frontend/e2e). Xem spreadsheet/impl/e2e-hook.ts. */
  readonly VITE_E2E_HOOKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
