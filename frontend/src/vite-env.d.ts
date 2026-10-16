/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the REST API. See `src/shared/api/constants.ts`. */
  readonly VITE_API_URL?: string;
  /** Giấy phép SpreadJS (bảng tính). Rỗng = bản dùng thử. */
  readonly VITE_SPREADJS_LICENSE_KEY?: string;
  /** Giấy phép SpreadJS Designer (thiết kế mẫu). Rỗng = bản dùng thử. */
  readonly VITE_SPREADJS_DESIGNER_LICENSE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
