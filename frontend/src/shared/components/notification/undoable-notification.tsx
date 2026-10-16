import React from "react";
import { useTranslate } from "@refinedev/core";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

type UndoableNotificationProps = {
  message: string;
  description?: string;
  undoableTimeout?: number;
  cancelMutation?: () => void;
  onClose?: () => void;
};

/**
 * "Đang xử lý, có hoàn tác" (Figma 317:109769, loại 5): vòng xoay, tiêu đề,
 * một dòng mô tả, nút chữ "Hoàn tác" bên phải, và một vạch chạy hết dọc mép
 * dưới trong đúng số giây còn lại để hoàn tác.
 */
export function UndoableNotification({
  message,
  description,
  undoableTimeout = 5,
  cancelMutation,
  onClose,
}: UndoableNotificationProps) {
  const t = useTranslate();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.();
    }, undoableTimeout * 1000);

    return () => clearTimeout(timer);
  }, [onClose, undoableTimeout]);

  const handleUndo = () => {
    cancelMutation?.();
    onClose?.();
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        "bg-card",
        "text-card-foreground",
        "rounded-lg",
        "px-4",
        "py-3",
        "shadow-e3",
        "border",
        "border-border",
        "w-[356px]",
        "max-w-full"
      )}
    >
      <div className={cn("flex", "items-start", "gap-3")}>
        <LoaderCircle
          aria-hidden
          className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground"
        />
        <div className={cn("min-w-0", "flex-1")}>
          <div className={cn("font-semibold", "text-foreground", "text-[13px]")}>
            {message}
          </div>
          {description && (
            <div className={cn("text-muted-foreground", "text-xs", "mt-0.5")}>
              {description}
            </div>
          )}
        </div>
        <Button
          variant="link"
          size="sm"
          onClick={handleUndo}
          className={cn("h-auto", "p-0", "text-xs", "font-semibold")}
        >
          {t("buttons.undo", "Hoàn tác")}
        </Button>
      </div>

      {/* Time left to undo. A CSS animation rather than a ticking state, so the
          bar costs no re-renders and stays exactly in step with the timer. */}
      <div
        aria-hidden
        className="bg-primary absolute bottom-0 left-0 h-0.5 w-full origin-left"
        style={{
          animation: `undoable-countdown ${undoableTimeout}s linear forwards`,
        }}
      />
      <style>{`@keyframes undoable-countdown { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
    </div>
  );
}

UndoableNotification.displayName = "UndoableNotification";
