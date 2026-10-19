"use client";

import {
  CircleAlert,
  CircleCheck,
  Info,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/shared/components/theme/theme-provider";

/**
 * Thông báo nổi theo Figma 317:109769: thẻ nền trắng có viền, icon tô màu theo
 * loại (thành công / cảnh báo / lỗi / thông tin / đang xử lý), tiêu đề đậm
 * vừa, mô tả nhỏ màu xám, nút hành động là chữ màu chính bên phải.
 *
 * Màu nằm ở icon chứ không ở nền thẻ: một chồng thẻ nền xanh/đỏ đặc trên màn
 * làm việc là quá ồn cho một câu báo "Đã lưu".
 */
export function Toaster({ ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Nhãn trợ năng mặc định của sonner là tiếng Anh ("Notifications alt+T", "Close toast").
      customAriaLabel="Thông báo (phím tắt Alt+T)"
      icons={{
        success: <CircleCheck className="size-4 text-success" />,
        warning: <TriangleAlert className="size-4 text-warning" />,
        error: <CircleAlert className="size-4 text-destructive" />,
        info: <Info className="size-4 text-info" />,
        loading: (
          <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
        ),
      }}
      toastOptions={{
        closeButtonAriaLabel: "Đóng thông báo",
        classNames: {
          toast: "!rounded-lg !border-border !shadow-e3 !items-start",
          title: "!text-[13px] !font-semibold !text-foreground",
          description: "!text-xs !text-muted-foreground",
          actionButton:
            "!bg-transparent !px-0 !text-xs !font-semibold !text-primary hover:!underline",
          cancelButton:
            "!bg-transparent !px-0 !text-xs !font-medium !text-muted-foreground",
          icon: "!mt-0.5",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
