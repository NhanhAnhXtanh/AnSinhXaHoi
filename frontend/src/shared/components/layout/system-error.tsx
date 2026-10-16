import { useMemo } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { StatusPage } from "@/shared/components/layout/status-page";
import { Button } from "@/shared/ui/button";

/**
 * Lỗi hệ thống ngoài ý muốn (Figma D1, 317:109765) — trang hiện khi một màn
 * vỡ lúc hiển thị. Dùng làm `fallback` của một error boundary bọc nội dung
 * trong khung ứng dụng; sidebar và thanh đầu vẫn còn để người dùng đi tiếp.
 *
 * "Mã báo lỗi" là thời điểm xảy ra lỗi (dd/MM/yyyy HH:mm:ss): thứ duy nhất cán
 * bộ đọc lại được cho bộ phận hỗ trợ để tìm đúng dòng nhật ký máy chủ, mà
 * không phải chép một chuỗi kỹ thuật.
 *
 * "Về trang chủ" là thẻ `<a>` thường (tải lại cả trang) chứ không đi qua bộ
 * định tuyến: khi một màn đã vỡ, trạng thái trong bộ nhớ không còn đáng tin.
 */
export function SystemError({
  onReload,
  occurredAt,
}: {
  /** Mặc định tải lại cả trang. */
  onReload?: () => void;
  /** Mặc định là lúc trang này hiện ra. */
  occurredAt?: Date;
}) {
  const stamp = useMemo(() => formatStamp(occurredAt ?? new Date()), [occurredAt]);

  return (
    <StatusPage
      icon={TriangleAlert}
      title="Có sự cố ngoài ý muốn"
      description="Hệ thống gặp trục trặc nên chưa hiển thị được trang này. Số liệu bạn đã lưu vẫn còn nguyên; bạn bấm Tải lại trang để thử lại."
      actions={
        <>
          <Button
            variant="outline"
            onClick={() => (onReload ? onReload() : window.location.reload())}
          >
            <RefreshCw />
            Tải lại trang
          </Button>
          <Button variant="link" asChild>
            <a href="/">Về trang chủ</a>
          </Button>
        </>
      }
      footnote={`Mã báo lỗi: ${stamp}`}
    />
  );
}

function formatStamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

SystemError.displayName = "SystemError";
