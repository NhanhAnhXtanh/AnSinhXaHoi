# Icon dùng trong app

Bộ icon của bản React là **Lucide**, cùng một phiên bản ở Figma và ở code:

- Code: `lucide-react` **1.49.0** (ghim đúng bản trong `frontend/package.json`, không dùng `^`). Nâng bản thì
  phải nâng cả Figma và cập nhật file này.
- Figma: file "An Sinh Xã Hội", trang "An Sinh Xã Hội - React/Spring", khung **Icons** — mỗi icon là một
  component 24×24 tên đúng tên Lucide (`save`, `x`, `calendar`…), nét gắn biến `icon-action`.
- Tên trong Figma viết kiểu `kebab-case` (`triangle-alert`); trong code là `PascalCase`
  (`TriangleAlert`, hoặc `TriangleAlertIcon` — hai cách viết cùng một icon).

Quy tắc:

- Chỉ dùng icon Lucide. Không dùng emoji, ký tự chữ (‹ › … ▾ ✓ ●) hay SVG tự vẽ làm icon.
- Dùng tên mới của Lucide 1.x, không dùng tên cũ: `House` (không `Home`), `LoaderCircle` (không `Loader2`),
  `TriangleAlert` (không `AlertTriangle`), `Ellipsis` (không `MoreHorizontal`), `BuildingComplex`
  (không `Building2`), `Trash` (bản 1.x đã có hai vạch dọc, không còn `Trash2` riêng).
- Ngoại lệ: `shared/ui/` là file shadcn sinh ra, giữ nguyên cách viết của shadcn (đang dùng
  `MoreHorizontal`, vẫn chạy vì Lucide giữ tên cũ làm bí danh). Không sửa tay các file đó.
- Thêm icon mới vào code thì thêm một dòng vào bảng dưới.

## Bảng icon (sinh từ `frontend/src`, 15/10/2026)

| Tên Lucide (Figma) | Import trong code | Dùng ở |
| --- | --- | --- |
| `arrow-down` | `ArrowDown` | `shared/components/data-table/data-table-sorter.tsx`<br>`shared/components/data-table/data-table.tsx` |
| `arrow-left` | `ArrowLeft`, `ArrowLeftIcon` | `features/identity/components/forgot-password-form.tsx`<br>`shared/components/views/create-view.tsx`<br>`shared/components/views/edit-view.tsx`<br>`shared/components/views/show-view.tsx`<br>`shared/ui/carousel.tsx` |
| `arrow-right` | `ArrowRight` | `shared/ui/carousel.tsx` |
| `arrow-up` | `ArrowUp` | `shared/components/data-table/data-table-sorter.tsx`<br>`shared/components/data-table/data-table.tsx` |
| `bell` | `Bell`, `BellIcon` | `app/resources/index.tsx`<br>`shared/components/layout/notification-bell.tsx` |
| `building-complex` | `BuildingComplex` | `app/resources/index.tsx` |
| `check` | `Check`, `CheckIcon` | `features/administration/roles/permission-matrix.tsx`<br>`shared/components/data-table/data-table-filter.tsx`<br>`shared/components/theme/theme-customizer.tsx`<br>`shared/components/theme/theme-select.tsx`<br>`shared/ui/checkbox.tsx`<br>`shared/ui/context-menu.tsx`<br>`shared/ui/dropdown-menu.tsx`<br>`shared/ui/menubar.tsx`<br>`shared/ui/select.tsx` |
| `check-check` | `CheckCheckIcon` | `features/notifications/list.tsx`<br>`shared/components/layout/notification-bell.tsx` |
| `chevron-down` | `ChevronDown`, `ChevronDownIcon` | `features/administration/roles/edit.tsx`<br>`shared/components/theme/theme-select.tsx`<br>`shared/ui/accordion.tsx`<br>`shared/ui/navigation-menu.tsx`<br>`shared/ui/select.tsx` |
| `chevron-left` | `ChevronLeft`, `ChevronLeftIcon` | `shared/components/data-table/data-table-pagination.tsx`<br>`shared/components/layout/error-component.tsx`<br>`shared/ui/calendar.tsx`<br>`shared/ui/pagination.tsx` |
| `chevron-right` | `ChevronRight`, `ChevronRightIcon` | `shared/components/data-table/data-table-pagination.tsx`<br>`shared/components/layout/sidebar.tsx`<br>`shared/ui/breadcrumb.tsx`<br>`shared/ui/calendar.tsx`<br>`shared/ui/context-menu.tsx`<br>`shared/ui/dropdown-menu.tsx`<br>`shared/ui/menubar.tsx`<br>`shared/ui/pagination.tsx` |
| `chevron-up` | `ChevronUpIcon` | `features/administration/roles/edit.tsx`<br>`shared/ui/select.tsx` |
| `chevrons-left` | `ChevronsLeft` | `shared/components/data-table/data-table-pagination.tsx` |
| `chevrons-right` | `ChevronsRight` | `shared/components/data-table/data-table-pagination.tsx` |
| `chevrons-up-down` | `ChevronsUpDown` | `shared/components/data-table/data-table-filter.tsx`<br>`shared/components/data-table/data-table-sorter.tsx`<br>`shared/components/data-table/data-table.tsx` |
| `circle` | `CircleIcon` | `shared/ui/context-menu.tsx`<br>`shared/ui/dropdown-menu.tsx`<br>`shared/ui/menubar.tsx`<br>`shared/ui/radio-group.tsx` |
| `circle-alert` | `CircleAlertIcon` | `shared/components/layout/notification-bell.tsx` |
| `circle-check` | `CircleCheckIcon` | `shared/components/layout/notification-bell.tsx` |
| `columns-3` | `Columns3Icon` | `shared/components/data-table/data-table-actions.tsx` |
| `copy` | `Copy` | `shared/components/buttons/clone.tsx` |
| `download` | `DownloadIcon` | `shared/components/data-table/data-table-actions.tsx` |
| `ellipsis` | `MoreHorizontal`, `MoreHorizontalIcon` | `shared/ui/breadcrumb.tsx`<br>`shared/ui/pagination.tsx` |
| `eye` | `Eye` | `shared/components/buttons/show.tsx`<br>`shared/components/form/input-password.tsx` |
| `eye-off` | `EyeOff` | `shared/components/form/input-password.tsx` |
| `grip-vertical` | `GripVerticalIcon` | `shared/ui/resizable.tsx` |
| `house` | `House` | `shared/components/layout/breadcrumb.tsx` |
| `inbox` | `Inbox` | `shared/components/data-table/data-table.tsx` |
| `info` | `InfoIcon` | `shared/components/layout/error-component.tsx`<br>`shared/components/layout/notification-bell.tsx` |
| `key-round` | `KeyRound`, `KeyRoundIcon` | `app/resources/index.tsx`<br>`features/administration/users/reset-password-card.tsx` |
| `layers` | `LayersIcon` | `app/App.tsx` |
| `layout-dashboard` | `LayoutDashboard` | `app/resources/index.tsx` |
| `list` | `List`, `ListIcon` | `shared/components/buttons/list.tsx`<br>`shared/components/layout/sidebar.tsx` |
| `list-checks` | `ListChecks` | `app/resources/index.tsx` |
| `list-filter` | `ListFilter` | `shared/components/data-table/data-table-filter.tsx` |
| `loader-circle` | `LoaderCircle`, `LoaderCircleIcon` | `shared/components/buttons/delete.tsx`<br>`shared/components/data-table/data-table-actions.tsx`<br>`shared/components/data-table/data-table.tsx`<br>`shared/components/layout/loading-overlay.tsx` |
| `log-out` | `LogOutIcon` | `shared/components/layout/header.tsx`<br>`shared/components/layout/sidebar.tsx` |
| `minus` | `MinusIcon` | `features/administration/roles/permission-matrix.tsx`<br>`shared/ui/input-otp.tsx` |
| `monitor` | `Monitor` | `shared/components/theme/theme-customizer.tsx`<br>`shared/components/theme/theme-select.tsx`<br>`shared/components/theme/theme-toggle.tsx` |
| `moon` | `Moon` | `shared/components/theme/theme-customizer.tsx`<br>`shared/components/theme/theme-select.tsx`<br>`shared/components/theme/theme-toggle.tsx` |
| `network` | `Network` | `app/resources/index.tsx` |
| `newspaper` | `Newspaper` | `app/resources/index.tsx` |
| `paintbrush` | `Paintbrush` | `shared/components/theme/theme-customizer.tsx` |
| `panel-left` | `PanelLeftIcon` | `shared/components/layout/sidebar.tsx`<br>`shared/ui/sidebar.tsx` |
| `pencil` | `Pencil` | `shared/components/buttons/edit.tsx` |
| `plus` | `Plus` | `features/administration/roles/data-scopes.tsx`<br>`features/administration/row-level-policies/scope-builder.tsx`<br>`shared/components/buttons/create.tsx` |
| `refresh-ccw` | `RefreshCcw` | `shared/components/buttons/refresh.tsx` |
| `refresh-cw` | `RefreshCwIcon` | `shared/components/data-table/data-table-actions.tsx` |
| `rotate-ccw` | `RotateCcw` | `shared/components/theme/theme-customizer.tsx` |
| `search` | `Search`, `SearchIcon` | `features/administration/roles/permission-matrix.tsx`<br>`shared/components/data-table/data-table-quick-filter.tsx`<br>`shared/components/layout/header.tsx`<br>`shared/ui/command.tsx` |
| `shield` | `ShieldIcon` | `features/administration/roles/edit.tsx`<br>`features/administration/users/show.tsx` |
| `shield-alert` | `ShieldAlertIcon` | `shared/components/layout/forbidden.tsx` |
| `shield-check` | `ShieldCheck` | `app/resources/index.tsx` |
| `shield-half` | `ShieldHalf` | `app/resources/index.tsx` |
| `shield-off` | `ShieldOff`, `ShieldOffIcon` | `features/administration/users/show.tsx`<br>`shared/components/data-table/data-table.tsx` |
| `sliders-horizontal` | `SlidersHorizontal` | `shared/components/data-table/data-table-advanced-filter.tsx` |
| `sun` | `Sun` | `shared/components/theme/theme-customizer.tsx`<br>`shared/components/theme/theme-select.tsx`<br>`shared/components/theme/theme-toggle.tsx` |
| `tags` | `Tags` | `app/resources/index.tsx` |
| `trash` | `Trash` | `shared/components/buttons/delete.tsx` |
| `triangle-alert` | `TriangleAlert`, `TriangleAlertIcon` | `features/administration/roles/data-scopes.tsx`<br>`features/administration/roles/permission-matrix.tsx`<br>`features/administration/row-level-policies/edit.tsx`<br>`features/administration/row-level-policies/list.tsx`<br>`features/administration/row-level-policies/scope-builder.tsx`<br>`features/administration/row-level-policies/show.tsx`<br>`shared/components/form/unsaved-changes-guard.tsx`<br>`shared/components/layout/notification-bell.tsx` |
| `user-round` | `UserRoundIcon` | `shared/components/layout/header.tsx`<br>`shared/components/layout/sidebar.tsx` |
| `users` | `Users` | `app/resources/index.tsx` |
| `x` | `X`, `XIcon` | `features/administration/row-level-policies/scope-builder.tsx`<br>`shared/components/data-table/data-table-advanced-filter.tsx`<br>`shared/components/data-table/data-table-filter.tsx`<br>`shared/components/data-table/data-table-quick-filter.tsx`<br>`shared/ui/dialog.tsx`<br>`shared/ui/sheet.tsx` |
