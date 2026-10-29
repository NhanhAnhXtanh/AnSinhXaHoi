import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { EmptyState, SheetTabs, WorkCard } from "@/shared/components/asxh";

import { FullscreenButton, FullscreenFrame } from "./fullscreen-frame";

/**
 * Khung thẻ làm việc của màn Tổng hợp: đầu thẻ (tên kỳ / năm, nhãn, dòng phụ, thao
 * tác), thân là bảng tính, chân là hàng tab biểu ("+N biểu khác" khi tràn) kèm nút
 * toàn màn hình.
 */
export function SheetFrame({
  title,
  badge,
  meta,
  actions,
  tabs,
  tab,
  onTabChange,
  children,
}: {
  title: ReactNode;
  badge?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  tabs: { key: string; label: string; done?: boolean }[];
  tab: string;
  onTabChange: (key: string) => void;
  children: ReactNode;
}) {
  const [full, setFull] = useState(false);
  const exitFull = useCallback(() => setFull(false), []);

  return (
    <FullscreenFrame full={full} onExit={exitFull}>
      <WorkCard
        title={title}
        badge={badge}
        meta={meta}
        actions={actions}
        footer={
          tabs.length > 0 ? (
            <SheetTabs
              tabs={tabs}
              value={tab}
              onChange={onTabChange}
              maxVisible={6}
              overflowLabel={(n) => `+${n} biểu khác`}
              trailing={<FullscreenButton full={full} onToggle={() => setFull((f) => !f)} />}
            />
          ) : undefined
        }
      >
        {children}
      </WorkCard>
    </FullscreenFrame>
  );
}

/** Thân thẻ khi chưa có bảng: khung viền đứt giữa thẻ. */
export function SheetEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="rounded-lg border border-dashed px-10">
        <EmptyState icon={icon} title={title} description={description} action={action} />
      </div>
    </div>
  );
}

/** Thân thẻ khi tải lỗi. */
export function SheetError({ message, action }: { message: string; action?: ReactNode }) {
  return <SheetEmpty icon={TriangleAlert} title="Chưa mở được bảng tổng hợp" description={message} action={action} />;
}

/** Vùng chứa bảng tính: chiếm hết phần còn lại của thẻ. */
export function SheetBody({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col p-4">{children}</div>;
}
