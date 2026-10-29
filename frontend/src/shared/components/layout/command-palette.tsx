"use client";

import { useMenu, type TreeMenuItem } from "@refinedev/core";
import React from "react";
import { useNavigate } from "react-router";

import {
  getDisplayName,
  getIcon,
  useAccessibleMenuItems,
} from "@/shared/components/layout/menu-items";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";

type PaletteEntry = { key: string; label: string; route: string; icon: React.ReactNode };
type PaletteGroup = { heading?: string; entries: PaletteEntry[] };

/** Bỏ dấu để gõ "nhap lieu" vẫn ra "Nhập liệu báo cáo". */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/**
 * Cây menu → các nhóm của ô tìm kiếm. Nhóm (`meta.group`) thành tiêu đề, mọi
 * màn bên trong (kể cả menu con lồng nhau) xếp phẳng dưới tiêu đề đó; màn đứng
 * một mình ở gốc (Trang chủ) gom vào nhóm không tiêu đề đặt đầu tiên.
 */
function toGroups(items: TreeMenuItem[]): PaletteGroup[] {
  const leaves = (nodes: TreeMenuItem[]): PaletteEntry[] =>
    nodes.flatMap((node) => {
      const children = (node.children ?? []) as TreeMenuItem[];
      if (children.length > 0) return leaves(children);
      if (!node.route) return [];
      return [
        {
          key: node.key || node.name,
          label: getDisplayName(node),
          route: node.route,
          icon: getIcon(node),
        },
      ];
    });

  const top: PaletteEntry[] = [];
  const groups: PaletteGroup[] = [];
  for (const item of items) {
    if (item.meta?.group) {
      const entries = leaves((item.children ?? []) as TreeMenuItem[]);
      if (entries.length > 0) groups.push({ heading: getDisplayName(item), entries });
    } else {
      top.push(...leaves([item]));
    }
  }
  return top.length > 0 ? [{ entries: top }, ...groups] : groups;
}

/**
 * Ô tìm kiếm Ctrl K: tìm và mở nhanh một màn hình trong menu.
 *
 * Lấy đúng cây menu thanh bên đang hiện (đã lọc theo quyền), nên màn nào không
 * có trên menu thì cũng không tìm thấy ở đây. Thay cho `<RefineKbar />`, vốn
 * dựng danh sách từ mọi resource — kể cả màn ẩn — và thêm các lệnh
 * "List / Create" tiếng Anh.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { menuItems } = useMenu();
  const visibleItems = useAccessibleMenuItems(menuItems);
  const groups = React.useMemo(() => toGroups(visibleItems), [visibleItems]);
  const navigate = useNavigate();

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tìm màn hình"
      description="Gõ tên màn hình để mở nhanh"
      showCloseButton={false}
      className="top-[20%] translate-y-0 sm:max-w-lg"
    >
      <CommandInput placeholder="Tìm màn hình…" />
      <CommandList className="max-h-[min(420px,60svh)]">
        <CommandEmpty>Không tìm thấy màn hình phù hợp.</CommandEmpty>
        {groups.map((group, index) => (
          <CommandGroup key={group.heading ?? `top-${index}`} heading={group.heading}>
            {group.entries.map((entry) => (
              <CommandItem
                key={entry.key}
                value={entry.label}
                keywords={[fold(entry.label), ...(group.heading ? [group.heading, fold(group.heading)] : [])]}
                onSelect={() => {
                  onOpenChange(false);
                  navigate(entry.route);
                }}
              >
                <span className="flex shrink-0 items-center [&_svg]:size-4">{entry.icon}</span>
                <span className="truncate">{entry.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
