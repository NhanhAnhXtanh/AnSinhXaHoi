import { useMemo } from "react";
import {
  type BaseRecord,
  type HttpError,
  useCreate,
  useCustom,
  useCustomMutation,
  useDelete,
  useInvalidate,
  useList,
  useOne,
  useUpdate,
} from "@refinedev/core";

import { API_URL } from "@/shared/api/constants";

import {
  KIND_TO_API,
  errorText,
  toForm,
  toSet,
  toVersion,
} from "./model";
import type {
  ApiTemplate,
  ApiTemplateScript,
  ApiTemplateSet,
  ApiTemplateVersion,
  FormKind,
  TemplateScriptPayload,
} from "./types";

/**
 * Nối màn mẫu biểu với API thật:
 * - `GET/POST/PATCH/DELETE /api/template_sets`
 * - `GET/POST/PATCH/DELETE /api/templates` + `POST /api/templates/{id}/next_version`
 * - `GET/PATCH/DELETE /api/template_versions` + `POST /api/template_versions/{id}/
 *   publish|lock|unlock|revoke|start_testing|stop_testing`
 * - `GET /api/template_versions/{id}/scripts` + `PUT …/scripts/summary` (kịch bản)
 *
 * Danh sách phiên bản không có workbook (máy chủ không đọc cột đó); chỉ `getOne`
 * của một phiên bản mới trả về — màn Thiết kế mẫu nạp khi mở. Kịch bản đọc riêng.
 */
export const RESOURCE = {
  sets: "template_sets",
  forms: "templates",
  versions: "template_versions",
} as const;

/* ------------------------------------------------------------------ */
/* Đọc                                                                  */
/* ------------------------------------------------------------------ */

export function useTemplateSets() {
  const { result, query } = useList<ApiTemplateSet>({
    resource: RESOURCE.sets,
    pagination: { pageSize: 200 },
    sorters: [{ field: "name", order: "asc" }],
  });
  const sets = useMemo(() => (result?.data ?? []).map(toSet), [result?.data]);
  return {
    sets,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/** Biểu và mọi phiên bản (dạng gọn) của một bộ mẫu. */
export function useSetContent(setId: string | null) {
  const enabled = Boolean(setId);
  const formsQuery = useList<ApiTemplate>({
    resource: RESOURCE.forms,
    pagination: { pageSize: 500 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    filters: [{ field: "set.id", operator: "eq", value: setId ?? "" }],
    queryOptions: { enabled },
  });
  const versionsQuery = useList<ApiTemplateVersion>({
    resource: RESOURCE.versions,
    pagination: { pageSize: 1000 },
    filters: [{ field: "template.set.id", operator: "eq", value: setId ?? "" }],
    queryOptions: { enabled },
  });

  const formData = formsQuery.result?.data;
  const versionData = versionsQuery.result?.data;
  const forms = useMemo(() => (formData ?? []).map(toForm), [formData]);
  const versions = useMemo(() => (versionData ?? []).map(toVersion), [versionData]);

  return {
    forms,
    versions,
    isLoading:
      enabled && (formsQuery.query.isLoading || versionsQuery.query.isLoading),
    isError: formsQuery.query.isError || versionsQuery.query.isError,
    refetch: () => {
      void formsQuery.query.refetch();
      void versionsQuery.query.refetch();
    },
  };
}

/** Một phiên bản đầy đủ (kèm workbook và script) — cho màn Thiết kế mẫu. */
export function useTemplateVersion(id: string | undefined) {
  const { result, query } = useOne<ApiTemplateVersion>({
    resource: RESOURCE.versions,
    id: id ?? "",
    queryOptions: {
      enabled: Boolean(id),
      // Workbook có thể vài MB: không tự nạp lại khi quay lại tab trình duyệt.
      refetchOnWindowFocus: false,
    },
  });
  return {
    version: result,
    isLoading: query.isLoading,
    isError: query.isError,
    statusCode: (query.error as { statusCode?: number } | null)?.statusCode,
  };
}

/** Chuỗi phiên bản của một biểu (màn thiết kế chỉ mở đúng một biểu). */
export function useDesignerContext(formId: string | null) {
  const chainQuery = useList<ApiTemplateVersion>({
    resource: RESOURCE.versions,
    pagination: { pageSize: 200 },
    filters: [{ field: "template.id", operator: "eq", value: formId ?? "" }],
    queryOptions: { enabled: Boolean(formId) },
  });
  const chainData = chainQuery.result?.data;
  const chain = useMemo(
    () => (chainData ?? []).map(toVersion).sort((a, b) => b.number - a.number),
    [chainData]
  );
  return { chain };
}

/**
 * Mọi kịch bản của phiên bản (kể cả đang tắt), theo thứ tự chạy — màn soạn kịch bản trong
 * Thiết kế mẫu. `scripts` là `undefined` khi chưa tải xong.
 */
export function useTemplateScripts(versionId: string) {
  const { result, query } = useCustom<ApiTemplateScript[]>({
    url: `${API_URL}/${RESOURCE.versions}/${versionId}/scripts`,
    method: "get",
    queryOptions: { staleTime: 0, gcTime: 0 },
  });
  // Chưa có dữ liệu thì useCustom trả một object rỗng (không phải mảng) — xem use-custom-result.ts.
  const data = result?.data as unknown;
  const scripts = Array.isArray(data) ? (data as ApiTemplateScript[]) : undefined;
  return {
    scripts,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/* ------------------------------------------------------------------ */
/* Ghi                                                                  */
/* ------------------------------------------------------------------ */

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type VersionAction =
  | "publish"
  | "lock"
  | "unlock"
  | "revoke"
  | "start_testing"
  | "stop_testing";

const JSON_HEADERS = { headers: { "Content-Type": "application/json" } };

/**
 * Mọi việc ghi của hai màn mẫu biểu. Mỗi hàm trả `Result` thay vì ném lỗi:
 * máy chủ kiểm lại mọi luật và trả câu báo tiếng Việt (409) — màn chỉ việc
 * hiện câu đó. Thông báo mặc định của Refine tắt hết, màn tự `toast`.
 */
export function useTemplateActions() {
  const invalidate = useInvalidate();
  type Values = Record<string, unknown>;
  const { mutateAsync: create } = useCreate<BaseRecord, HttpError, Values>();
  const { mutateAsync: update } = useUpdate<BaseRecord, HttpError, Values>();
  const { mutateAsync: remove } = useDelete<BaseRecord, HttpError>();
  const { mutateAsync: custom } = useCustomMutation<BaseRecord, HttpError, Values>();

  async function refreshLists() {
    await Promise.all(
      Object.values(RESOURCE).map((resource) =>
        invalidate({ resource, invalidates: ["list", "many"] })
      )
    );
  }

  async function run<T>(
    work: () => Promise<T>,
    fallback: string
  ): Promise<Result<T>> {
    try {
      const value = await work();
      await refreshLists();
      return { ok: true, value };
    } catch (error) {
      return { ok: false, error: errorText(error, fallback) };
    }
  }

  const quiet = { successNotification: false as const, errorNotification: false as const };

  return {
    createSet: (input: { name: string; description?: string }) =>
      run(async () => {
        const res = await create({
          resource: RESOURCE.sets,
          values: { name: input.name.trim(), description: input.description?.trim() || null },
          ...quiet,
        });
        return toSet(res.data as unknown as ApiTemplateSet);
      }, "Không tạo được bộ mẫu. Hãy thử lại."),

    updateSet: (id: string, input: { name: string; description?: string }) =>
      run(async () => {
        const res = await update({
          resource: RESOURCE.sets,
          id,
          // Mô tả để trống thì gửi chuỗi rỗng (máy chủ coi là xoá); null là giữ nguyên.
          values: { name: input.name.trim(), description: input.description?.trim() ?? "" },
          mutationMode: "pessimistic",
          ...quiet,
        });
        return toSet(res.data as unknown as ApiTemplateSet);
      }, "Không lưu được bộ mẫu. Hãy thử lại."),

    deleteSet: (id: string) =>
      run(async () => {
        await remove({ resource: RESOURCE.sets, id, ...quiet });
      }, "Không xoá được bộ mẫu. Hãy thử lại."),

    createForm: (input: {
      setId: string;
      shortName: string;
      name: string;
      kind: FormKind;
      effectiveFrom: string;
    }) =>
      run(async () => {
        const res = await create({
          resource: RESOURCE.forms,
          values: {
            set: { id: Number(input.setId) },
            shortName: input.shortName.trim(),
            name: input.name.trim(),
            kind: KIND_TO_API[input.kind],
            effectiveFrom: input.effectiveFrom,
          },
          ...quiet,
        });
        const api = res.data as unknown as ApiTemplate;
        return {
          form: toForm(api),
          firstVersionId: api.latestVersion ? String(api.latestVersion.id) : null,
        };
      }, "Không tạo được biểu mẫu. Hãy thử lại."),

    deleteForm: (id: string) =>
      run(async () => {
        await remove({ resource: RESOURCE.forms, id, ...quiet });
      }, "Không xoá được biểu. Hãy thử lại."),

    nextVersion: (formId: string) =>
      run(async () => {
        const res = await custom({
          url: `${API_URL}/${RESOURCE.forms}/${formId}/next_version`,
          method: "post",
          values: {},
          config: JSON_HEADERS,
          ...quiet,
        });
        return toVersion(res.data as unknown as ApiTemplateVersion);
      }, "Không tạo được phiên bản kế tiếp. Hãy thử lại."),

    versionAction: (
      versionId: string,
      action: VersionAction,
      body?: { effectiveFrom?: string }
    ) =>
      run(async () => {
        const res = await custom({
          url: `${API_URL}/${RESOURCE.versions}/${versionId}/${action}`,
          method: "post",
          values: body ?? {},
          config: JSON_HEADERS,
          ...quiet,
        });
        await invalidate({
          resource: RESOURCE.versions,
          id: versionId,
          invalidates: ["detail"],
        });
        return toVersion(res.data as unknown as ApiTemplateVersion);
      }, "Không thực hiện được. Hãy thử lại."),

    deleteVersion: (versionId: string) =>
      run(async () => {
        await remove({ resource: RESOURCE.versions, id: versionId, ...quiet });
      }, "Không xoá được phiên bản. Hãy thử lại."),

    /**
     * Lưu từ màn Thiết kế mẫu (workbook và/hoặc cả danh sách kịch bản) — PATCH một lần. Không
     * nạp lại chi tiết phiên bản sau khi lưu (sẽ kéo lại cả workbook vài MB
     * về đúng thứ vừa gửi đi).
     */
    saveVersion: (
      versionId: string,
      values: { workbookJson?: string; scripts?: TemplateScriptPayload[] }
    ) =>
      run(async () => {
        const res = await update({
          resource: RESOURCE.versions,
          id: versionId,
          values,
          mutationMode: "pessimistic",
          invalidates: ["list", "many"],
          ...quiet,
        });
        return toVersion(res.data as unknown as ApiTemplateVersion);
      }, "Không lưu được thiết kế. Hãy thử lại."),

    /**
     * Phiên bản đã ban hành: thay riêng nhóm kịch bản tổng hợp (có hàm getSummaryData) —
     * `PUT /template_versions/{id}/scripts/summary`. Kịch bản khác của phiên bản giữ nguyên.
     */
    saveSummaryScripts: (versionId: string, scripts: TemplateScriptPayload[]) =>
      run(async () => {
        const res = await custom({
          url: `${API_URL}/${RESOURCE.versions}/${versionId}/scripts/summary`,
          method: "put",
          values: scripts as unknown as Values,
          config: JSON_HEADERS,
          ...quiet,
        });
        return res.data as unknown as ApiTemplateScript[];
      }, "Không lưu được kịch bản tổng hợp. Hãy thử lại."),
  };
}

export type TemplateActions = ReturnType<typeof useTemplateActions>;
