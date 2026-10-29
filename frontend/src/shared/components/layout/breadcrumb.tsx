"use client";

import { Fragment, useMemo } from "react";
import { House } from "lucide-react";
import { useLocation } from "react-router";
import {
  matchResourceFromRoute,
  useBreadcrumb,
  useLink,
  useResourceParams,
} from "@refinedev/core";
import {
  BreadcrumbSeparator as ShadcnBreadcrumbSeparator,
  BreadcrumbItem as ShadcnBreadcrumbItem,
  BreadcrumbList as ShadcnBreadcrumbList,
  BreadcrumbPage as ShadcnBreadcrumbPage,
  Breadcrumb as ShadcnBreadcrumb,
} from "@/shared/ui/breadcrumb";

/**
 * Refine dựng nhãn thao tác bằng bản dịch mặc định tiếng Anh ("Create", "Show"…)
 * vì ứng dụng không gắn i18nProvider; ở đây đổi sang chữ cho cán bộ.
 */
const ACTION_LABELS: Record<string, string> = {
  Create: "Thêm mới",
  Edit: "Chỉnh sửa",
  Show: "Chi tiết",
  Clone: "Sao chép",
  List: "Danh sách",
};

/** Màn con không phải thao tác của resource nhưng khớp mẫu `/:id` của nó. */
const PATH_LABELS: Record<string, string> = {
  "/annual-review/history": "Lịch sử nộp",
};

export function Breadcrumb() {
  const Link = useLink();
  const { pathname } = useLocation();
  const { breadcrumbs } = useBreadcrumb();
  const { resources } = useResourceParams();
  const rootRouteResource = matchResourceFromRoute("/", resources);

  const breadCrumbItems = useMemo(() => {
    const list: {
      key: string;
      href: string;
      Component: React.ReactNode;
    }[] = [];

    list.push({
      key: "breadcrumb-item-home",
      href: rootRouteResource.matchedRoute ?? "/",
      Component: (
        <Link to={rootRouteResource.matchedRoute ?? "/"} aria-label="Trang chủ">
          {rootRouteResource?.resource?.meta?.icon ?? (
            <House className="h-4 w-4" />
          )}
        </Link>
      ),
    });

    breadcrumbs.forEach(({ label: rawLabel, href }, index) => {
      const isLast = index === breadcrumbs.length - 1;
      const label =
        (isLast ? PATH_LABELS[pathname] : undefined) ??
        ACTION_LABELS[rawLabel] ??
        rawLabel;
      list.push({
        key: `breadcrumb-item-${label}`,
        href: href ?? "",
        Component: href ? <Link to={href}>{label}</Link> : <span>{label}</span>,
      });
    });

    return list;
  }, [breadcrumbs, Link, rootRouteResource, pathname]);

  return (
    <ShadcnBreadcrumb>
      <ShadcnBreadcrumbList>
        {breadCrumbItems.map((item, index) => {
          if (index === breadCrumbItems.length - 1) {
            return (
              <ShadcnBreadcrumbPage key={item.key}>
                {item.Component}
              </ShadcnBreadcrumbPage>
            );
          }

          return (
            <Fragment key={item.key}>
              <ShadcnBreadcrumbItem key={item.key}>
                {item.Component}
              </ShadcnBreadcrumbItem>
              <ShadcnBreadcrumbSeparator />
            </Fragment>
          );
        })}
      </ShadcnBreadcrumbList>
    </ShadcnBreadcrumb>
  );
}

Breadcrumb.displayName = "Breadcrumb";
