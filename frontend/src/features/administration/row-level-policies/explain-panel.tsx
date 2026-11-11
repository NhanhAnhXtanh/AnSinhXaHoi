import { useCustom, useCustomMutation, useSelect } from "@refinedev/core";
import { useState } from "react";

import { customResult } from "@/shared/hooks/use-custom-result";
import { API_URL } from "@/shared/api/constants";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Separator } from "@/shared/ui/separator";
import { ACTIONS, type ExplainResponse } from "@/domains/row-level-policy/types";
import { roleName } from "@/shared/lib/role-names";
import { becauseVi, readCompiledVi } from "./labels";
import { actionLabel, resourceLabel } from "../labels";

const EVALUATED_LABELS: Record<string, string> = {
  TRUE: "đúng",
  FALSE: "sai",
  UNKNOWN: "không xác định",
};

type SimulateResult = {
  allowed: boolean;
  evaluatedAs: "TRUE" | "FALSE" | "UNKNOWN";
  failedAt: string | null;
  because: string | null;
};

/**
 * The two operational tools, on the page where somebody already has the policy
 * in front of them.
 *
 * `Explain` answers "which rule is doing this". `Simulate` answers "why can
 * this person not see that record", and it answers in three values rather than
 * two — because `UNKNOWN` is both the commonest answer and the one nobody
 * guesses. It almost always means a null foreign key turning a whole branch
 * unknown, and unknown refuses the row.
 *
 * Both need `users:read` on top of the policy permission: simulating somebody
 * else's access is reading about somebody else. The panel simply does not
 * render for an account without it, because the endpoints would 403.
 */
export function ExplainPanel({
  resource,
  action: initialAction,
}: {
  resource: string;
  action: string;
}) {
  const [userId, setUserId] = useState<string>("");
  const [action, setAction] = useState<string>(initialAction);
  const [recordId, setRecordId] = useState<string>("");
  const [simulation, setSimulation] = useState<SimulateResult | null>(null);

  const { options: userOptions } = useSelect({
    resource: "users",
    optionLabel: "fullName",
    optionValue: "id",
    sorters: [{ field: "username", order: "asc" }],
  });

  const { result: explainResult, query: explainQuery } = useCustom<ExplainResponse>({
    url: `${API_URL}/row_level_policies/explain`,
    method: "get",
    config: { query: { resource, action, userId } },
    queryOptions: { enabled: Boolean(userId) },
  });

  const { mutate: simulate, mutation } = useCustomMutation<SimulateResult>();

  // Disabled until an account is chosen, so this is the empty-object sentinel
  // far more often than not.
  const explanation = customResult(explainResult?.data, "principal");

  function runSimulation() {
    if (!userId || !recordId) return;
    // Bỏ kết quả của lần trước: lần này hỏng thì không để lại câu trả lời cũ trông như mới.
    setSimulation(null);
    simulate(
      {
        url: `${API_URL}/row_level_policies/simulate`,
        method: "post",
        values: {
          resource,
          action,
          userId: Number(userId),
          recordId: Number(recordId),
        },
        // Data provider tự tuần tự hoá thân yêu cầu thành chuỗi; thiếu kiểu nội dung thì máy chủ
        // trả 415 và nút không bao giờ ra kết quả (như reset-password-card).
        config: { headers: { "Content-Type": "application/json" } },
        successNotification: false,
        errorNotification: (error) => ({
          type: "error",
          message: "Không kiểm tra được dòng dữ liệu",
          description:
            error && typeof error === "object" && "message" in error
              ? String((error as { message?: unknown }).message ?? "")
              : undefined,
        }),
      },
      {
        onSuccess: (response) => setSimulation(response.data as SimulateResult),
      }
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kiểm tra ai thấy gì</CardTitle>
        <CardDescription>
          Chọn một tài khoản để xem các phạm vi cộng lại cho tài khoản đó thấy
          gì trên {resourceLabel(resource)}. Nhập thêm mã số một dòng dữ liệu để
          biết vì sao dòng đó được thấy hay không.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Tài khoản</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Chọn tài khoản" />
              </SelectTrigger>
              <SelectContent>
                {(userOptions ?? []).map((option) => (
                  <SelectItem key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Thao tác</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.map((candidate) => (
                  <SelectItem key={candidate} value={candidate}>
                    {actionLabel(candidate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Mã số dòng dữ liệu</Label>
            <Input
              className="w-[160px]"
              type="number"
              value={recordId}
              placeholder="Không bắt buộc"
              onChange={(e) => setRecordId(e.target.value)}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={!userId || !recordId || mutation.isPending}
            onClick={runSimulation}
          >
            {mutation.isPending ? "Đang kiểm tra..." : "Kiểm tra dòng này"}
          </Button>
        </div>

        {simulation && (
          <Alert variant={simulation.allowed ? "default" : "destructive"}>
            <AlertDescription className="flex flex-col gap-1">
              <span className="font-medium">
                {simulation.allowed ? "Được phép" : "Bị từ chối"} — kết quả{" "}
                {EVALUATED_LABELS[simulation.evaluatedAs] ?? simulation.evaluatedAs}
              </span>
              {simulation.failedAt && (
                <span className="text-xs">Điều kiện không đạt: {readCompiledVi(simulation.failedAt)}</span>
              )}
              {simulation.because && <span>{becauseVi(simulation.because)}</span>}
              {simulation.evaluatedAs === "UNKNOWN" && (
                <span className="text-xs">
                  “Không xác định” nghĩa là từ chối, không phải “có thể”. Điều
                  kiện so với một giá trị trống thì không có kết quả, và dòng
                  không có kết quả sẽ không được hiện.
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {userId && !explainQuery.isLoading && explanation && (
          <>
            <Separator />

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Vai trò:</span>
              {explanation.principal.roleCodes.map((role) => (
                <Badge key={role} variant="secondary" className="text-[11px]">
                  {roleName(role)}
                </Badge>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Điều kiện đang áp dụng
              </span>
              <p className="bg-muted rounded-md p-3 text-sm break-words">
                {readCompiledVi(explanation.effective)}
              </p>
            </div>

            <RuleList
              title="Phạm vi mở rộng"
              hint="Các phạm vi này cộng dồn với nhau, nên có thêm vai trò chỉ thấy rộng hơn."
              rules={explanation.scopes}
            />
            <RuleList
              title="Phạm vi hạn chế"
              hint="Các phạm vi này luôn thu hẹp và không thuộc vai trò nào, nên không ai thoát được."
              rules={explanation.filters}
            />

            {explanation.warnings.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription className="flex flex-col gap-1">
                  {explanation.warnings.map((warning, index) => (
                    <span key={index}>{warning}</span>
                  ))}
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RuleList({
  title,
  hint,
  rules,
}: {
  title: string;
  hint: string;
  rules: ExplainResponse["scopes"];
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {title}
      </span>
      {rules.length === 0 ? (
        <p className="text-muted-foreground text-sm">Không có.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule) => (
            <div
              key={rule.source}
              className="flex flex-col gap-1 rounded-md border p-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={rule.applies ? "default" : "outline"}>
                  {rule.applies ? "Đang áp dụng" : "Không giữ vai trò"}
                </Badge>
                <span className="text-sm font-medium">{rule.name}</span>
              </div>
              {/*
                The compiled form, not the JSON that was typed. Normalisation is
                the part most likely to surprise whoever wrote the rule, so
                showing the authored version here would be showing the wrong
                thing.
              */}
              <p className="text-sm break-words">{readCompiledVi(rule.reads)}</p>
              {/*
                Only when the two clauses differ. Repeating an identical
                condition twice reads like a mistake in the rule rather than a
                property of it.
              */}
              {rule.checks && (
                <p className="text-muted-foreground text-sm break-words">
                  Sau khi lưu: {readCompiledVi(rule.checks)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}
