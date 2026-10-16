import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";

import { formatDate, formatNumber } from "@/shared/components/asxh";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import type { ReviewReport } from "../fixtures";
import { treasuryAmount } from "../model";

const ZOOM_STEPS = [50, 75, 100, 125, 150, 200];
const FIT_ZOOM = 100;

/**
 * Xem file xác nhận của Kho bạc đơn vị đính kèm khi nộp. Chưa có tệp thật:
 * trang giấy được giả lập từ số liệu của phiếu.
 */
export function TreasuryDialog({
  report,
  open,
  onOpenChange,
}: {
  report: ReviewReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [fileIndex, setFileIndex] = useState(0);
  const [zoom, setZoom] = useState(FIT_ZOOM);

  const files = report.treasuryFiles;
  const file = files[Math.min(fileIndex, files.length - 1)];
  const zoomPos = ZOOM_STEPS.indexOf(zoom);
  const amount = treasuryAmount(report);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setFileIndex(0);
      setZoom(FIT_ZOOM);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader className="text-left">
          <DialogTitle>Xác nhận của Kho bạc</DialogTitle>
          <DialogDescription>
            Phiếu {report.period.name} · {report.orgName}
          </DialogDescription>
        </DialogHeader>

        {!file ? (
          <p className="bg-surface-subtle text-muted-foreground rounded-md px-4 py-10 text-center text-sm">
            Đơn vị chưa đính kèm file xác nhận của Kho bạc.
          </p>
        ) : (
          <>
            <div className="bg-surface-subtle flex flex-wrap items-center gap-2 rounded-md border p-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Thu nhỏ"
                disabled={zoomPos <= 0}
                onClick={() => setZoom(ZOOM_STEPS[Math.max(0, zoomPos - 1)] ?? FIT_ZOOM)}
              >
                <ZoomOut />
              </Button>
              <span className="w-12 text-center text-sm tabular-nums">{zoom}%</span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Phóng to"
                disabled={zoomPos >= ZOOM_STEPS.length - 1}
                onClick={() =>
                  setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, zoomPos + 1)] ?? FIT_ZOOM)
                }
              >
                <ZoomIn />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setZoom(FIT_ZOOM)}>
                Vừa khung
              </Button>

              <div className="mx-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Tệp trước"
                  disabled={fileIndex === 0}
                  onClick={() => setFileIndex((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft />
                </Button>
                <span className="text-sm tabular-nums">
                  Tệp {fileIndex + 1} / {files.length}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Tệp sau"
                  disabled={fileIndex >= files.length - 1}
                  onClick={() => setFileIndex((i) => Math.min(files.length - 1, i + 1))}
                >
                  <ChevronRight />
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toast.success(`Đã tải về tệp "${file.name}".`)}
              >
                <Download />
                Tải về
              </Button>
            </div>

            <div className="bg-surface-subtle flex h-[22rem] items-center justify-center overflow-auto rounded-md p-6">
              <div
                className="origin-center transition-transform duration-150"
                style={{ transform: `scale(${zoom / 100})` }}
              >
                <article
                  aria-label={file.name}
                  className="bg-card text-card-foreground shadow-e2 flex w-[17rem] flex-col gap-1.5 border px-6 py-6 text-[11px] leading-relaxed"
                >
                  <p className="text-muted-foreground text-center text-[10px] font-medium uppercase">
                    Kho bạc Nhà nước Đồng Nai
                  </p>
                  <p className="text-center text-sm font-bold">{file.title}</p>
                  <p className="text-muted-foreground mb-2 text-center">{report.period.name}</p>
                  <p>Đơn vị: {report.orgName}</p>
                  <p>Nội dung: Chi trả các chế độ an sinh xã hội</p>
                  <p className="font-semibold">Số tiền: {formatNumber(amount)} đồng</p>
                  <p>Ngày xác nhận: {formatDate(file.confirmedAt)}</p>
                  <div className="mt-2 flex flex-col gap-1.5" aria-hidden>
                    <span className="bg-muted h-1.5 w-full rounded-full" />
                    <span className="bg-muted h-1.5 w-full rounded-full" />
                    <span className="bg-muted h-1.5 w-full rounded-full" />
                    <span className="bg-muted mx-auto h-1.5 w-2/3 rounded-full" />
                  </div>
                </article>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
