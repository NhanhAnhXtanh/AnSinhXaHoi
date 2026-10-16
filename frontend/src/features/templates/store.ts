import { useSyncExternalStore } from "react";

import {
  CHANGE_LOG,
  CURRENT_USER,
  TEMPLATE_FORMS,
  TEMPLATE_SETS,
  TEMPLATE_VERSIONS,
  type ChangeLogEntry,
  type FormKind,
  type TemplateForm,
  type TemplateSet,
  type TemplateVersion,
} from "./fixtures";
import {
  canClone,
  canDelete,
  canLock,
  canPublish,
  formLabel,
  nextDay,
  previousLiveVersion,
  toIsoDate,
  toIsoDateTime,
  versionsOf,
} from "./model";
import { formatDate } from "@/shared/components/asxh";

/**
 * Trạng thái giả lập dùng chung cho màn Bộ biểu mẫu và màn Thiết kế mẫu, để
 * ban hành ở màn thiết kế rồi quay lại vẫn thấy đúng trạng thái. Sống trong bộ
 * nhớ trang — tải lại trang là về dữ liệu mẫu. Thay bằng API khi backend có.
 */
export type TemplateState = {
  sets: TemplateSet[];
  forms: TemplateForm[];
  versions: TemplateVersion[];
  logs: ChangeLogEntry[];
};

let state: TemplateState = {
  sets: TEMPLATE_SETS,
  forms: TEMPLATE_FORMS,
  versions: TEMPLATE_VERSIONS,
  logs: CHANGE_LOG,
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getState() {
  return state;
}

function setState(next: TemplateState) {
  state = next;
  listeners.forEach((l) => l());
}

export function useTemplateState(): TemplateState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export type Result<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

let seq = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++seq}`;

/** Ghi một dòng lịch sử thay đổi và đẩy ngày cập nhật của bộ mẫu. */
function withLog(next: TemplateState, setId: string, content: string): TemplateState {
  const now = new Date();
  return {
    ...next,
    sets: next.sets.map((s) =>
      s.id === setId ? { ...s, updatedAt: toIsoDate(now) } : s
    ),
    logs: [
      { id: newId("log"), setId, at: toIsoDateTime(now), actor: CURRENT_USER, content },
      ...next.logs,
    ],
  };
}

function findVersion(versionId: string) {
  const version = state.versions.find((x) => x.id === versionId);
  const form = version && state.forms.find((f) => f.id === version.formId);
  if (!version || !form) return null;
  return { version, form, chain: versionsOf(state.versions, form.id) };
}

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("vi") === b.trim().toLocaleLowerCase("vi");

/* ------------------------------------------------------------------ */
/* Bộ mẫu (UC-09)                                                       */
/* ------------------------------------------------------------------ */

export function saveSet(input: {
  id?: string;
  name: string;
  description?: string;
}): Result<TemplateSet> {
  const name = input.name.trim();
  if (!name) return fail("Hãy nhập tên bộ mẫu.");
  if (state.sets.some((s) => s.id !== input.id && sameName(s.name, name)))
    return fail("Tên bộ mẫu đã tồn tại.");

  const today = toIsoDate(new Date());
  const description = input.description?.trim() || undefined;

  if (input.id) {
    const old = state.sets.find((s) => s.id === input.id);
    if (!old) return fail("Không tìm thấy bộ mẫu.");
    const updated: TemplateSet = { ...old, name, description };
    let next: TemplateState = {
      ...state,
      sets: state.sets.map((s) => (s.id === old.id ? updated : s)),
    };
    if (old.name !== name)
      next = withLog(next, old.id, `Đổi tên bộ mẫu thành “${name}”`);
    else next = withLog(next, old.id, "Sửa mô tả bộ mẫu");
    setState(next);
    return ok(updated);
  }

  const created: TemplateSet = {
    id: newId("set"),
    name,
    description,
    createdAt: today,
    updatedAt: today,
  };
  setState(
    withLog(
      { ...state, sets: [created, ...state.sets] },
      created.id,
      `Tạo bộ mẫu “${name}”`
    )
  );
  return ok(created);
}

export function versionCountOfSet(setId: string): number {
  const formIds = new Set(
    state.forms.filter((f) => f.setId === setId).map((f) => f.id)
  );
  return state.versions.filter((x) => formIds.has(x.formId)).length;
}

export function deleteSet(setId: string): Result<undefined> {
  const count = versionCountOfSet(setId);
  if (count > 0)
    return fail(
      `Không xoá được bộ mẫu này: đang có ${count} phiên bản. Hãy xoá từng phiên bản trước (phiên bản đã ban hành không xoá được).`
    );
  setState({
    ...state,
    sets: state.sets.filter((s) => s.id !== setId),
    forms: state.forms.filter((f) => f.setId !== setId),
    logs: state.logs.filter((l) => l.setId !== setId),
  });
  return ok(undefined);
}

/* ------------------------------------------------------------------ */
/* Biểu mẫu (UC-10)                                                     */
/* ------------------------------------------------------------------ */

export function createForm(input: {
  setId: string;
  name: string;
  kind: FormKind;
  effectiveFrom: string;
}): Result<{ form: TemplateForm; version: TemplateVersion }> {
  const name = input.name.trim();
  if (
    state.forms.some((f) => f.setId === input.setId && sameName(f.name, name))
  )
    return fail(`Bộ này đã có biểu ${name}.`);

  const form: TemplateForm = {
    id: newId("form"),
    setId: input.setId,
    name,
    kind: input.kind,
  };
  const version: TemplateVersion = {
    id: newId("ver"),
    formId: form.id,
    number: 1,
    status: "draft",
    effectiveFrom: input.effectiveFrom,
    publishedAt: null,
    approver: null,
    usedCount: 0,
  };
  setState(
    withLog(
      {
        ...state,
        forms: [...state.forms, form],
        versions: [...state.versions, version],
      },
      input.setId,
      `Tạo ${formLabel(form).toLowerCase()}`
    )
  );
  return ok({ form, version });
}

/* ------------------------------------------------------------------ */
/* Phiên bản (UC-13..16)                                                */
/* ------------------------------------------------------------------ */

function replaceVersion(next: TemplateVersion): TemplateState {
  return {
    ...state,
    versions: state.versions.map((x) => (x.id === next.id ? next : x)),
  };
}

const label = (form: TemplateForm, v: TemplateVersion) =>
  `phiên bản ${v.number} của ${formLabel(form).toLowerCase()}`;

/** Ngày sớm nhất được chọn khi ban hành (sau ngày áp dụng của bản trước), hoặc null. */
export function minEffectiveDate(versionId: string): string | null {
  const found = findVersion(versionId);
  if (!found) return null;
  const prev = previousLiveVersion(found.chain, found.version);
  return prev?.effectiveFrom ? nextDay(prev.effectiveFrom) : null;
}

export function publishVersion(
  versionId: string,
  effectiveFrom: string | null
): Result<TemplateVersion> {
  const found = findVersion(versionId);
  if (!found) return fail("Không tìm thấy phiên bản.");
  const { version, form } = found;
  const allowed = canPublish(version);
  if (!allowed.ok) return fail(allowed.reason);
  if (!effectiveFrom) return fail("Hãy chọn ngày áp dụng trước khi ban hành.");
  const min = minEffectiveDate(versionId);
  if (min && effectiveFrom < min)
    return fail(`Ngày áp dụng phải từ ${formatDate(min)} trở đi.`);

  const next: TemplateVersion = {
    ...version,
    status: "published",
    effectiveFrom,
    publishedAt: toIsoDateTime(new Date()),
    approver: CURRENT_USER,
  };
  setState(withLog(replaceVersion(next), form.setId, `Ban hành ${label(form, version)}`));
  return ok(next);
}

export function cloneVersion(versionId: string): Result<TemplateVersion> {
  const found = findVersion(versionId);
  if (!found) return fail("Không tìm thấy phiên bản.");
  const { version, form, chain } = found;
  const allowed = canClone(chain, version);
  if (!allowed.ok) return fail(allowed.reason);

  const created: TemplateVersion = {
    id: newId("ver"),
    formId: form.id,
    number: (chain[0]?.number ?? version.number) + 1,
    status: "draft",
    effectiveFrom: null,
    publishedAt: null,
    approver: null,
    usedCount: 0,
  };
  setState(
    withLog(
      { ...state, versions: [...state.versions, created] },
      form.setId,
      `Tạo ${label(form, created)}`
    )
  );
  return ok(created);
}

export function toggleLock(versionId: string): Result<TemplateVersion> {
  const found = findVersion(versionId);
  if (!found) return fail("Không tìm thấy phiên bản.");
  const { version, form, chain } = found;
  const allowed = canLock(chain, version);
  if (!allowed.ok) return fail(allowed.reason);

  const locking = version.status === "published";
  const next: TemplateVersion = {
    ...version,
    status: locking ? "locked" : "published",
  };
  setState(
    withLog(
      replaceVersion(next),
      form.setId,
      `${locking ? "Khoá" : "Mở khoá"} ${label(form, version)}`
    )
  );
  return ok(next);
}

export function deleteVersion(versionId: string): Result<undefined> {
  const found = findVersion(versionId);
  if (!found) return fail("Không tìm thấy phiên bản.");
  const { version, form, chain } = found;
  const allowed = canDelete(chain, version);
  if (!allowed.ok) return fail(allowed.reason);

  setState(
    withLog(
      { ...state, versions: state.versions.filter((x) => x.id !== version.id) },
      form.setId,
      `Xoá ${label(form, version)}`
    )
  );
  return ok(undefined);
}

/** Ghi lại một lần lưu thiết kế hoặc quy tắc ở màn Thiết kế mẫu. */
export function saveDesign(versionId: string, what: "design" | "rules"): Result<undefined> {
  const found = findVersion(versionId);
  if (!found) return fail("Không tìm thấy phiên bản.");
  const { version, form } = found;
  if (!canPublish(version).ok)
    return fail("Phiên bản này đã ban hành hoặc đã khoá — không sửa được nữa. Hãy tạo phiên bản kế tiếp.");
  setState(
    withLog(
      state,
      form.setId,
      what === "design"
        ? `Sửa thiết kế ${label(form, version)}`
        : `Sửa quy tắc nhập ${label(form, version)}`
    )
  );
  return ok(undefined);
}
