# Phân quyền ở Frontend — resource, action, menu

Tài liệu này mô tả toàn bộ chuỗi xử lý quyền phía `frontend/`: mã quyền được sinh ra
thế nào, ai hỏi, ai trả lời, và cache được giữ đúng bằng cách nào.

Nguyên tắc bao trùm: **lớp này che, không chặn.** Mọi endpoint backend kiểm lại đúng
mã quyền đó bằng `@PreAuthorize`, nên sửa URL trong devtools chỉ đổi được 403 lấy 403.
Access control ở đây tồn tại để UI trung thực về những gì người dùng làm được, không
phải để cưỡng chế.

---

## 1. Quy tắc gốc: mã quyền được suy ra, không tra bảng

Mã quyền có dạng `{resource}:{read|write|delete}`, trong đó nửa đầu là **tên resource
nguyên văn** trong `src/routes.tsx`.

`src/providers/access-control.ts`

```ts
const ACTION_TO_PERMISSION: Record<string, "read" | "write" | "delete"> = {
  list: "read",
  show: "read",
  create: "write",
  edit: "write",
  clone: "write",   // clone → write, vì thứ nó tạo ra là một bản ghi mới
  delete: "delete",
};

export function permissionFor(
  resource: string | undefined,
  action: string
): string | null {
  if (!resource) return null;
  const suffix = ACTION_TO_PERMISSION[action];
  return suffix ? `${resource}:${suffix}` : null;
}
```

Sáu action của Refine gom về ba quyền của API. Vì mã được *ghép* từ dữ liệu Refine
đã đưa sẵn (resource + action), **không có bảng ánh xạ resource → permission ở bất kỳ
phía nào** để lệch nhau theo thời gian.

Hệ quả: tên resource là thứ chịu tải ba lần cùng lúc —

| Vai trò | Ví dụ |
| --- | --- |
| Segment đường dẫn của data provider | `GET /api/blog_posts` |
| Nửa đầu mã quyền | `blog_posts:read` |
| Khoá của permission đã seed trong migration | `005-seed-security.sql` |

Nên `blog_posts` giữ nguyên dấu gạch dưới ở cả ba nơi. Đổi tên ở `routes.tsx` là phải
đổi endpoint và seed data cùng lúc.

`permissionFor` được **export** vì sidebar cũng cần nó (mục 4).

---

## 2. `can` — quyết định UI có chào mời hành động đó không

`src/providers/access-control.ts`

```ts
export const accessControlProvider: AccessControlProvider = {
  async can({ resource, action }) {
    const permissions = getAuthorities()?.permissions;

    // Không có gì trong cache = session đã mất. <Authenticated> đang redirect
    // ra /login rồi; trả "no" ở đây chỉ để tránh loé lên một menu đầy đủ.
    if (!permissions) return { can: false };

    // Node nhóm không có route ("Content", "Administration") không có resource
    // của riêng nó để authorise. Từ chối nó sẽ ẩn cả section kể cả khi các con
    // vẫn hiện.
    if (!resource) return { can: true };

    const required = permissionFor(resource, action);

    // Một action chưa ai định nghĩa permission. Cho qua để custom action không
    // biến mất trong im lặng; API vẫn là bên quyết định.
    if (!required) return { can: true };

    return permissions.includes(required)
      ? { can: true }
      : { can: false, reason: `You need the ${required} permission` };
  },
  ...
};
```

**Vì sao bắt buộc phải đọc đồng bộ từ bộ nhớ:** Refine gọi `can` cho mỗi menu item,
mỗi `<CanAccess>`, và mỗi nút action trên mỗi dòng. Một bảng 20 dòng × 4 nút là 80 câu
hỏi trên một lần render. Nếu mỗi câu là một HTTP request thì kiến trúc này không dùng
được — đó là lý do permissions phải nằm sẵn trong cache của `session.ts`.

---

## 3. Nút bấm — ẩn chứ không disable

```ts
options: {
  buttons: {
    enableAccessControl: true,
    hideIfUnauthorized: true,
  },
},
```

Các component `*Button` của `components/refine-ui/` (`EditButton`, `DeleteButton`,
`CreateButton`, `ShowButton`, `CloneButton`) tự hỏi `can` và tự ẩn.

Chọn ẩn thay vì disable là một quyết định về UX: một nút xám mời người dùng đi tìm hiểu
vì sao mình không bấm được, trong khi một hành động không thuộc vai trò của họ không
phải thứ họ đang thiếu một bước để đạt tới.

---

## 4. Menu — `useMenu` **không** áp dụng access control

Đây là điểm dễ quên nhất và sai lặng nhất trong toàn bộ hệ thống.

`useMenu` của Refine chỉ loại bỏ item có `meta.hide`, hoặc item không có cả `list` route
lẫn children. Nó **không** hỏi `accessControlProvider`. Vì vậy sidebar phải tự lọc lại
cây menu — bằng chính `permissionFor` mà provider dùng, để hai bên không thể lệch.

`src/components/refine-ui/layout/sidebar.tsx`

```ts
function useAccessibleMenuItems(items: TreeMenuItem[]): TreeMenuItem[] {
  const { data: permissions } = usePermissions<string[]>({});

  return React.useMemo(() => {
    if (!permissions) return items;

    const filter = (nodes: TreeMenuItem[]): TreeMenuItem[] =>
      nodes.flatMap((node) => {
        const children = filter((node.children ?? []) as TreeMenuItem[]);
        if (children.length > 0) {
          return [{ ...node, children }];
        }
        // Node không còn con nào sống sót chỉ được giữ nếu bản thân nó là một
        // đích đến thật, và tài khoản này được phép mở.
        if (!node.route) return [];

        const required = permissionFor(node.name, "list");
        return !required || permissions.includes(required) ? [node] : [];
      });

    return filter(items);
  }, [items, permissions]);
}

export function Sidebar() {
  const { menuItems, selectedKey } = useMenu();
  const visibleItems = useAccessibleMenuItems(menuItems);
  ...
}
```

Lọc **đệ quy từ dưới lên** là thứ làm nguyên nhóm *Administration* biến mất thay vì để
lại một tiêu đề section trống rỗng: header chỉ sống sót nếu còn ít nhất một con sống sót.

Menu chỉ hỏi quyền `list` (tức `{resource}:read`) — đúng với ý nghĩa của một mục điều
hướng: nó chỉ đưa người dùng tới danh sách.

> **Cạm bẫy:** thêm một admin resource mới mà quên rằng lọc nằm ở đây, thì mục đó được
> chào mời cho tất cả mọi người, rồi bị API từ chối khi họ bấm vào.

---

## 5. Route — `<CanAccess>` chỉ dành cho URL gõ tay

`src/routes.tsx`

```tsx
<Route
  path="/users"
  element={
    <CanAccess
      resource="users"
      action="list"
      fallback={<Forbidden resource="users" />}
    >
      <Outlet />
    </CanAccess>
  }
>
  <Route index element={<UserList />} />
  <Route path="create" element={<UserCreate />} />
  <Route path="edit/:id" element={<UserEdit />} />
  <Route path="show/:id" element={<UserShow />} />
</Route>
```

Sidebar đã ẩn các route này rồi, nên guard chỉ có tác dụng với URL bookmark hoặc gõ tay.
Không có nó thì màn hình vẫn render, list request trả 403, và người dùng nhận một cái
bảng trống kèm toast thay vì một lời giải thích.

Đây là phép lịch sự, không phải ranh giới bảo mật.

**Ngoại lệ có chủ ý:** `/notifications` không bọc `<CanAccess>`. Cả ba system role đều
được cấp `notifications:read`, và các dòng luôn là của chính người gọi, nên không có URL
nào cần canh.

---

## 6. Node nhóm và resource không khai báo

Trong `resources[]` của `routes.tsx` có hai loại mục đặc biệt:

- **Section header** (`content`, `administration`): resource không có route nào, chỉ mang
  `meta.group: true`. `useMenu` giữ chúng vì chúng có children; sidebar render chúng thành
  tiêu đề. Trong `can`, chúng rơi vào nhánh `if (!resource) return { can: true }`.

- **`permissions` cố tình không được khai báo.** Nó được đọc bởi picker trong form Role
  qua `useList({ resource: "permissions" })` — vốn không cần khai báo — và không có màn
  hình riêng. Khai báo nó sẽ đặt một mục nav trỏ tới một route không tồn tại.

---

## 7. Cache permissions nằm ở đâu và được giữ đúng bằng cách nào

Access token **không** mang permission (nó chỉ nói *ai*, không nói *được gì*). UI lấy
permissions từ `GET /api/auth/permissions` và cache trong `localStorage` dưới key
`dth-auth-authorities`.

`src/providers/session.ts` là nơi duy nhất chứa chúng, và `applyAuthorities` là **hàm ghi
duy nhất** — payload lấy từ HTTP và payload đẩy qua socket đáp xuống giống hệt nhau, client
không phân biệt được cái nào tới.

Bốn con đường giữ cache khỏi cũ:

| Thời điểm | Cơ chế | Chi phí |
| --- | --- | --- |
| Grants đổi, tab đang mở | push `/user/queue/auth` → `applyAuthorities` (`live.ts`) | **0 request** |
| Mọi response có `X-Auth-Version` khác | `reconcileAuthVersion` trong hook `afterResponse` (`data.ts`) | 0 request khi không có gì đổi |
| Một lần mỗi page load, trước khi shell render | `authProvider.check` → `revalidateAuthorities` | 1 request |
| Mỗi lần refresh token (~15 phút) | `performRefresh` (`session.ts`) | ghép sẵn vào request đã có |

Hai cơ chế đầu **không đá nhau**: cả hai ghi cùng một version stamp, nên cái nào tới trước
làm cái kia thành no-op. Đó cũng là lý do stamp đi **bên trong** body `AuthoritiesResponse`
chứ không chỉ ở header — một push không có header để đọc, và cập nhật codes mà không cập
nhật stamp sẽ khiến header của response kế tiếp trông như một thay đổi nữa.

### Vì sao `check` không gọi lại mỗi lần

`useIsAuthenticated` của Refine có `staleTime: 0` mặc định, nên `check` chạy lại mỗi lần
cửa sổ được focus và mỗi lần có observer mới mount — mà `routes.tsx` lại mount
`<Authenticated>` hai lần dưới cùng một query key. Không lần nào trong số đó biết thêm điều
gì mà một page load chưa biết.

Cờ `revalidated` trong `session.ts` giữ giới hạn "một lần mỗi page load"; nó reset khi
reload và khi `clearSession`. Cả hai thái cực đều từng là bug đã gặp:

- *Không bao giờ gọi lại* (luôn phục vụ từ cache): một quyền admin vừa sửa sẽ không bao giờ
  xuất hiện cho tới khi người dùng đăng xuất rồi đăng nhập lại — reload cũng không cứu được.
- *Gọi mỗi lần*: một request cho mỗi lần focus cửa sổ, đổi lấy không thông tin gì mới.

### Không bao giờ được chấp nhận danh sách rỗng

`loadAuthorities` trả `null` khi request lỗi — nghĩa là "không hỏi được", **không phải**
"không có quyền nào". Một shell rỗng trông y hệt một tài khoản bị thu hồi quyền. Vì vậy
`revalidateAuthorities` fallback về bản cache khi request hỏng, còn `check` chỉ
`clearSession()` khi thực sự không có session.

---

## 8. Mắt xích cuối: ép UI re-render khi quyền đổi

`can` đọc cache đồng bộ và **ngoài React**, nên ghi lại cache không làm gì re-render cả.
Thêm nữa, Refine giữ mọi câu trả lời `can` trong react-query. Không có bước này thì menu
sẽ giữ nguyên những gì nó quyết định ở lần paint đầu tiên.

`src/providers/authorities-sync.tsx`

```tsx
export const AuthoritiesSync = () => {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeToAuthorities(() => {
        void queryClient.invalidateQueries({ queryKey: ["access"] });
        void queryClient.invalidateQueries({ queryKey: ["auth", "permissions"] });
      }),
    [queryClient]
  );

  return null;
};
```

`loadAuthorities`/`applyAuthorities` chỉ notify subscriber **khi codes thật sự đổi**
(so sánh chuỗi JSON đã serialize), vì nó chạy trên mọi page load và việc vứt bỏ một cache
đang đúng là lãng phí.

> **Cạm bẫy:** hai query key trên là nội bộ của Refine (`useCan` dưới `access`,
> `usePermissions` dưới `auth`). Refine có `useInvalidateAuthStore` cho đúng việc này nhưng
> không export. Nếu một bản nâng cấp Refine đổi key, triệu chứng là file này im lặng không
> làm gì cả — không lỗi, không cảnh báo.

---

## 9. Khi API trả 403: data provider phải *ném*, không được trả về

`@refinedev/rest` hard-code `throwHttpErrors: false` trên ky instance của nó — và đặt
dòng đó **sau** khi spread `kyOptions`, nên không override được từ ngoài. Nó tự kiểm
`response.ok` trong `create`, `update`, `deleteOne`, `getMany` và `custom`, **nhưng không
kiểm trong `getList` và `getOne`**: hai method đó `await response.json()` rồi trả thẳng
kết quả ra làm dữ liệu.

Hậu quả: một 403 về tới trang dưới dạng `{status, message, errors}` đội lốt một bản ghi.
`query.isError` là `false`, không có toast, `authProvider.onError` không chạy — và cái
`.map` hoặc `for…of` đầu tiên trên nó làm sập cả màn hình (màn hình trắng, không error
boundary nào bắt được vì lỗi nằm trong render).

Đây chính xác là thứ xảy ra khi gỡ `categories:read` rồi mở `/blog-posts`:
`categories?.map is not a function`.

`src/providers/data.ts` đóng lỗ đó bằng một hook `afterResponse` **đặt cuối cùng**:

```ts
async (_request, _options, response) => {
  if (response.ok) return response;

  const body = await response.clone().json().catch(() => null);

  throw {
    message: body?.message || response.statusText || "Request failed",
    statusCode: response.status,
    errors: body?.errors,
  };
},
```

Ba lý do nó phải nằm **cuối** danh sách hook:

1. Hook retry-401 ở trên đã có cơ hội refresh token và replay request.
2. `reconcileAuthVersion` đã kịp đọc `X-Auth-Version` khỏi response.
3. Hình dạng ném ra đúng là `HttpError` của Refine (`{message, statusCode, errors}`) —
   thứ mà `authProvider.onError` và notification provider vốn đã chờ, và cũng là thứ
   `transformError` của chính provider tạo ra trên các nhánh có kiểm `ok`.

Sau khi sửa, một 403 trên `getList` cho `result.data = []` (Refine fallback về
`EMPTY_ARRAY`) kèm một toast — thay vì một object độc hại nằm trong vị trí của mảng.

**Ngoài ra, đừng bắt một 403 có thể đoán trước.** Nếu trang biết trước tài khoản không có
quyền đọc một resource phụ, nó nên không hỏi. `pages/blog-posts/list.tsx` gate lookup
categories bằng `useCan` rồi bỏ hẳn field filter tương ứng — cùng khuôn với cách
`use-notifications.ts` gate cái chuông:

```ts
const { data: canReadCategories } = useCan({ resource: "categories", action: "list" });
const mayReadCategories = canReadCategories?.can ?? false;

const { result: { data: categories } } = useList({
  resource: "categories",
  queryOptions: { enabled: mayReadCategories },
});
```

Provider fix là lớp an toàn (không màn hình trắng ở bất kỳ đâu); `useCan` gate là lớp
lịch sự (không request thừa, không toast lỗi mỗi lần vào trang).

---

## 10. Luồng đầy đủ, từ đăng nhập tới một cái nút

```
POST /api/auth/login
      │
      ├─ saveSession(tokens)              → dth-auth-access-token / -refresh-token / -identity
      └─ loadAuthorities()                → GET /api/auth/permissions
                                            └─ applyAuthorities() → dth-auth-authorities
                                                                  → dth-auth-version
                                                                  → notify listeners
<Authenticated>
      └─ authProvider.check()
            ├─ revalidateAuthorities()    → 1 lần / page load, sau đó đọc cache
            └─ connect()                  → mở STOMP, subscribe /user/queue/auth

Render
      ├─ Sidebar     → useMenu() → useAccessibleMenuItems() → permissionFor(name, "list")
      ├─ Route       → <CanAccess resource action> → can()
      └─ *Button     → hideIfUnauthorized → can()
                                              └─ getAuthorities().permissions.includes(code)

Khi admin sửa role
      ├─ push /user/queue/auth  → applyAuthorities()   (tab đang mở, 0 request)
      └─ X-Auth-Version lệch    → reconcileAuthVersion() → loadAuthorities()
                                    │
                                    └─ codes đổi → listeners → AuthoritiesSync
                                                    → invalidate ["access"], ["auth","permissions"]
                                                    → menu và nút render lại
```

---

## 11. Checklist: thêm một resource mới

1. **`src/routes.tsx` — `resources[]`**: khai báo `name` (chính là nửa đầu mã quyền), các
   action route, `meta.parent` nếu thuộc một section.
2. **`src/routes.tsx` — `<AppRoutes />`**: thêm `<Route>` khớp *chính xác* với các đường dẫn
   vừa khai báo. Lệch nhau thì nút và breadcrumb điều hướng vào hư không, không báo lỗi.
3. **Migration backend**: seed ba permission `{name}:read`, `{name}:write`, `{name}:delete`.
4. **Cấp cho role**: seed grant cho các system role cần thiết.
5. **`<CanAccess>`**: bọc route nếu đây là resource nhạy cảm cần giải thích khi bị từ chối.

Sidebar và các nút action **tự động đúng** — không có bảng ánh xạ nào phải cập nhật, vì mã
quyền được suy ra từ chính tên resource ở bước 1.

---

## Phụ lục — các lỗi đã sửa khi kiểm thử phân quyền

Ba lỗi dưới đây không nằm trong logic phân quyền, nhưng đều lộ ra khi gỡ một quyền rồi
mở màn hình liên quan, và cả ba đều báo sai chỗ. Ghi lại ở đây vì lần tới gặp triệu
chứng tương tự, chỗ nhìn đầu tiên không nên là access control.

Hai lỗi còn lại của cùng đợt — `getList`/`getOne` không kiểm `response.ok`, và việc gate
lookup bằng `useCan` thay vì đâm vào một 403 đoán trước được — nằm ở [mục 9](#9-khi-api-trả-403-data-provider-phải-ném-không-được-trả-về).

### A. `ky` nối `prefixUrl` vào cả URL tuyệt đối

**Triệu chứng.** Chuông thông báo không bao giờ load, console báo CORS:

```
Access to fetch at 'http://localhost:8080/api/http://localhost:8080/api/notifications/recent'
has been blocked by CORS policy
```

**Nguyên nhân.** `kyInstance` đã mang sẵn `prefixUrl: API_URL`, và ky nối prefix vào bất
cứ thứ gì nó nhận — kể cả một URL tuyệt đối. `use-notifications.ts` lại truyền
`` `${API_URL}/notifications/${path}` ``, ở cả ba chỗ (`get`, `markRead`, `markAllRead`).

**Sửa.** Đường dẫn tương đối, **không có dấu `/` đầu** (ky từ chối leading slash khi có
`prefixUrl`):

```ts
return kyInstance.get(`notifications/${path}`).json<T>();
```

Lỗi này có sẵn từ trước và không liên quan tới quyền — chỉ là nó nằm cạnh trong cùng một
console log nên dễ bị quy chung một mối.

### B. Tomcat từ chối `ids[0]` trước khi Spring kịp thấy

**Triệu chứng.** Mở form edit blog post, console báo CORS:

```
Access to fetch at 'http://localhost:8080/api/categories?ids[0]=8'
blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

**Nguyên nhân.** Không phải CORS. Kiểm bằng curl:

```
GET /api/categories?ids[0]=8       → 400, trang HTML của Tomcat
GET /api/categories?ids%5B0%5D=8   → 401, tới được Spring Security
```

`[` và `]` là gen-delims mà RFC 3986 chỉ cho phép trong phần host. Tomcat từ chối chúng
**ở tầng connector, trước mọi filter**, nên response là HTML 400 không mang header CORS
nào — và browser chỉ biết báo rằng preflight thiếu `Access-Control-Allow-Origin`.

Brackets đến từ đâu: `getMany` của `@refinedev/rest` dùng
`qs.stringify(query, { encodeValuesOnly: true })` — chỉ encode *values*, không encode
*keys* — rồi URL parser của browser cũng để `[`/`]` nguyên trong query string.
`ListParams.ids()` phía backend **vốn đã** nhận `ids=`, `ids[0]=` và `ids[]=`; request chỉ
là chưa bao giờ tới được nó.

**Sửa** — `backend/src/main/resources/application.properties`:

```properties
server.tomcat.relaxed-query-chars=[,]
```

Hai ký tự, chỉ trong query string; path parser không đụng tới. Sau khi restart, preflight
trả 200 kèm đủ `Access-Control-Allow-Origin` và `Access-Control-Expose-Headers`.

> Bài học chung của A và B: **một lỗi CORS trên màn hình hiếm khi là lỗi cấu hình CORS.**
> Nó thường là một response lỗi được sinh ra ở tầng thấp hơn tầng gắn header CORS. Curl
> thẳng vào endpoint trước khi động vào `WebMvcConfig`.

### C. `Select` không match lại khi options tới muộn

**Triệu chứng.** Mở edit form lần đầu, trường Category trống dù bản ghi có category. Đóng
đi mở lại thì hiện đúng.

**Nguyên nhân.** `Select` của Radix match `value` với các `<SelectItem>` **đang mounted tại
thời điểm đó**, và không match lại khi item xuất hiện muộn hơn. Code cũ đảm bảo đúng thứ
tự tệ nhất:

```tsx
const { options } = useSelect({
  resource: "categories",
  defaultValue: blogPostsData?.category?.id,
  queryOptions: { enabled: !!blogPostsData?.category?.id },   // ← gate
});
```

Cái `enabled` đó khoá query categories **sau lưng** record đã load, biến hai request thành
nối tiếp. Trên cache lạnh trình tự luôn là: record về → `useForm` reset → `category.id`
được set trong khi `SelectContent` còn rỗng → trigger hiện placeholder. Lần mở thứ hai
đúng chỉ vì react-query đã cache categories.

**Sửa.** Bản ghi trả về đã mang sẵn `category: { id, title }`, nên `defaultValue` đang đi
fetch bằng id đúng cái nó vừa có trong tay. Lấy thẳng từ record:

```tsx
const options = useMemo(() => {
  const list = categoryOptions ?? [];
  if (!recordCategory?.id) return list;
  return list.some((o) => String(o.value) === String(recordCategory.id))
    ? list
    : [{ label: recordCategory.title, value: recordCategory.id }, ...list];
}, [categoryOptions, recordCategory?.id, recordCategory?.title]);
```

Value và option giờ cùng derive từ một object nên không còn thứ tự để mà sai; bỏ được một
`getMany`; và category nằm ngoài trang đầu vẫn chọn được — đúng thứ `defaultValue` sinh ra
để làm. Query list được gate bằng `useCan` như mục 9, nên một role không có
`categories:read` vẫn **thấy** category hiện tại (từ record) mà không bị toast 403 đè lên
form.

Áp dụng cho cả `create.tsx`, vì route `/blog-posts/clone/:id` dùng chung component và có
đúng cấu trúc đó; với create thường (không có record) nó là no-op.

---

## Tham chiếu file

| File | Vai trò |
| --- | --- |
| `src/providers/access-control.ts` | `ACTION_TO_PERMISSION`, `permissionFor`, `can`, cấu hình ẩn nút |
| `src/providers/session.ts` | Nơi duy nhất chứa token, identity, authorities; `applyAuthorities`, `revalidateAuthorities`, `reconcileAuthVersion` |
| `src/providers/auth.ts` | `check` (revalidate + connect), `getPermissions` (đọc cache) |
| `src/providers/authorities-sync.tsx` | Invalidate query cache của Refine khi codes đổi |
| `src/providers/data.ts` | Gắn bearer token; hook `afterResponse` đọc `X-Auth-Version` |
| `src/providers/live.ts` | STOMP; subscribe `/user/queue/auth` |
| `src/routes.tsx` | `resources[]` + cây `<Route>` + các guard `<CanAccess>` |
| `src/components/refine-ui/layout/sidebar.tsx` | `useAccessibleMenuItems` — lọc menu |
| `src/pages/blog-posts/list.tsx` | Gate lookup categories bằng `useCan`; bỏ field filter khi không có quyền |
| `src/pages/blog-posts/edit.tsx`, `create.tsx` | Gate `useSelect`; merge category của record vào options |
| `src/hooks/use-notifications.ts` | Gate cái chuông bằng `useCan`; đường dẫn tương đối qua `kyInstance` |
| `backend/.../application.properties` | `server.tomcat.relaxed-query-chars=[,]` cho `getMany` |
