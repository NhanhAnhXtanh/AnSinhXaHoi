# THIẾT KẾ CHI TIẾT: PHÂN QUYỀN DÒNG DỮ LIỆU (ROW-LEVEL ROLES)

Tài liệu thiết kế chi tiết, dùng để thi công. Tự chứa — không cần đọc `rls-metadata-specification.md`, `row_level_role.md`, `row_level_role_new.md` hay `row_level_role_new_v2.md`; bốn tài liệu đó là quá trình đi tới thiết kế này và được giữ lại làm hồ sơ quyết định.

Đối tượng đọc: người hiện thực. Mọi lớp, bảng, endpoint và thay đổi lên mã nguồn hiện có đều được nêu tên cụ thể.

---

## MỤC LỤC

1. [Phạm vi và vị trí trong hệ thống](#1-phạm-vi-và-vị-trí-trong-hệ-thống)
2. [Mô hình khái niệm](#2-mô-hình-khái-niệm)
3. [ScopeTree và logic ba trị](#3-scopetree-và-logic-ba-trị)
4. [Cấu trúc package](#4-cấu-trúc-package)
5. [Khai báo phía feature](#5-khai-báo-phía-feature)
6. [Biên dịch](#6-biên-dịch)
7. [Điểm chặn](#7-điểm-chặn)
8. [Vòng đời ghi](#8-vòng-đời-ghi)
9. [Dữ liệu lồng trong payload](#9-dữ-liệu-lồng-trong-payload)
10. [Mô hình dữ liệu](#10-mô-hình-dữ-liệu)
11. [Cache và lan truyền](#11-cache-và-lan-truyền)
12. [Kiểm tra hai mức](#12-kiểm-tra-hai-mức)
13. [API quản trị](#13-api-quản-trị)
14. [Frontend](#14-frontend)
15. [Mô hình đe doạ](#15-mô-hình-đe-doạ)
16. [Kiểm thử](#16-kiểm-thử)
17. [Lộ trình thi công](#17-lộ-trình-thi-công)
18. [Phụ lục: kịch bản đầy đủ cho `tasks`](#18-phụ-lục-kịch-bản-đầy-đủ-cho-tasks)

---

## 1. PHẠM VI VÀ VỊ TRÍ TRONG HỆ THỐNG

### 1.1. Hai lớp phân quyền, nối tiếp nhau

| Lớp | Câu hỏi | Nơi quyết định | Từ chối bằng |
| :--- | :--- | :--- | :--- |
| **Resource permission** (đã có) | Được gọi `GET /api/tasks` không? | `@PreAuthorize` trên controller, đọc `AuthorityCache` | `403` |
| **Row-level** (tài liệu này) | Trong `tasks`, thấy những dòng nào? | `Specification` ghép vào truy vấn | dòng vắng mặt → `404` |

Không có `tasks:read` thì không bao giờ chạm tới lớp row-level. Có `tasks:read` mà phạm vi rỗng thì thấy danh sách trống — đó là câu trả lời đúng, không phải lỗi.

### 1.2. Từ vựng dùng chung, không có bảng ánh xạ

- **`resource`** — tên resource **nguyên văn** như khai báo trong `frontend/src/routes.tsx` và như nửa đầu của mã quyền trong `shared/security/Permissions`: `tasks`, `blog_posts`, `organizations`. Không có `entity_name` riêng.
- **`action`** — ba giá trị `read` / `write` / `delete`, đúng ba hành động mà sáu action của Refine đã thu gọn về trong `providers/access-control.ts`.
- **`role`** — khoá ngoại tới bảng `roles`, không phải chuỗi tự do.

Không có bảng tra cứu ở giữa để lệch pha. Sai chính tả trở thành lỗi khoá ngoại hoặc lỗi khởi động, không im lặng.

### 1.3. Bảy nguyên tắc

1. **Quyền cộng dồn.** Thêm một role không bao giờ làm mất dòng đang thấy được.
2. **Không có ngôn ngữ biểu thức ở tầng runtime.** Không SpEL, không Groovy, không script. Từ vựng đóng.
3. **Một khai báo, hai trình biên dịch, một ngữ nghĩa.** SQL và in-memory phải cho cùng câu trả lời, và có test chứng minh.
4. **Không thêm câu SQL nào cho việc phân quyền.**
5. **Không có cửa sổ dữ liệu cũ.** Đổi phòng, đổi role, đổi chính sách — hiệu lực ở request kế tiếp.
6. **Không thể quên.** Đường đọc không an toàn không tồn tại để gọi.
7. **Bật lên là no-op.** Đưa một resource đang chạy vào diện quản lý không đổi hành vi của ai.

---

## 2. MÔ HÌNH KHÁI NIỆM

### 2.1. Hai loại chính sách

Đây là quyết định trung tâm. Hai loại khác nhau ở **chỗ gắn vào**, và từ đó khác nhau ở **cách kết hợp**.

| | `SCOPE` | `FILTER` |
| :--- | :--- | :--- |
| Gắn vào | **một role** | **một resource** — áp cho mọi người |
| Trả lời | "Role này với tới được những dòng nào" | "Dòng nào không ai được chạm" |
| Kết hợp | **`OR`** giữa các role của người dùng | **`AND`**, luôn luôn |
| Vắng mặt nghĩa là | role đó không bị thu hẹp | không có hạn chế toàn cục |
| Ví dụ | "MANAGER thấy phòng mình" | "không ai thấy bản ghi `confidential`" |

**Vì sao phải có cả hai:**

`SCOPE` dùng `OR` vì role trong hệ thống này **cộng dồn** — `AuthorityCache` đã hợp permission code của mọi role. Một trưởng phòng có cả `MANAGER` (phòng mình) và `USER` (việc của mình) phải thấy **hợp** của hai phạm vi. Ghép bằng `AND` sẽ khiến thêm một role làm *mất* quyền, thứ không ai đoán được.

`FILTER` dùng `AND` và **không gắn role** vì một lệnh cấm phải không né được. Nếu lệnh cấm gắn vào role, người ta thoát nó bằng cách *không có* role mang lệnh cấm — và một role tạo ngày mai sẽ không có nó.

### 2.2. Đại số

```
VISIBLE(u, resource, action) =

      ⋁ { scope(r) : r ∈ roles(u) có SCOPE cho (resource, action) }        -- hợp
    ∧ ⋀ { filter(f) : f là FILTER của (resource, action) }                 -- giao

Không role nào của u có SCOPE   →  vế thứ nhất = defaultScope(resource)
Không có FILTER nào             →  vế thứ hai  = TRUE
```

`priority` **không tồn tại**. Một thuật toán phân quyền phụ thuộc thứ tự là một thuật toán không kiểm chứng được. `FILTER` luôn thắng vì nó là phép giao, không vì nó xếp trước.

### 2.3. `defaultScope` — khai báo trong mã nguồn

```java
public enum DefaultScope { FULL, NONE }
```

| | Nghĩa | Dùng khi |
| :--- | :--- | :--- |
| `FULL` | Role không khai `SCOPE` thì không bị thu hẹp | Đưa một resource **đang chạy** vào diện quản lý. Bật lên là no-op, không cần migration seed nào |
| `NONE` | Role không khai `SCOPE` thì không thấy dòng nào | **Khuyến nghị cho resource mới.** Quên viết chính sách thì màn hình trống ngay và có người báo trong một giờ, thay vì lộ dữ liệu trong im lặng |

`RowLevelPolicySet` **bắt buộc** hiện thực `defaultScope()`. Không có mặc định ngầm: đây là lựa chọn có ý thức tại đúng thời điểm đánh dấu resource, không phải hệ quả của việc quên.

**Đánh đổi phải nói rõ.** Với `FULL`, nếu `MANAGER` có `SCOPE` mà `USER` quên khai thì `USER` không bị thu hẹp. Thiết kế này không giấu điều đó mà làm cho nó **nhìn thấy được**: màn hình **ma trận phủ** (§13.4) tô đỏ mọi ô "không có SCOPE trên resource `FULL`", và `explain` (§13.2) nói thẳng lý do.

### 2.4. `USING` và `WITH CHECK`

| Action | USING — trạng thái **cũ** | WITH CHECK — trạng thái **mới** |
| :--- | :--- | :--- |
| `read` (list, show, getMany) | ✔ ghép vào `WHERE` | — |
| `write` / create | — (chưa có dòng) | ✔ sau `flush()` |
| `write` / update | ✔ | ✔ |
| `delete` | ✔ | — |

`WITH CHECK` là mệnh đề chặn việc **đẩy một dòng ra khỏi phạm vi của chính mình** — sửa `department` của task sang phòng khác để giấu nó khỏi phòng mình. Không có nó, `USING` một mình là một lỗ hổng leo thang quyền bằng cách rửa dữ liệu.

---

## 3. SCOPETREE VÀ LOGIC BA TRỊ

### 3.1. Ngữ pháp

Chính sách runtime là **dữ liệu**, không phải ngôn ngữ.

```
Node  := { "all": [Node...] }          // AND
       | { "any": [Node...] }          // OR
       | { "not": Node }
       | Leaf

Leaf  := { "field": <path>, "op": <operator>, "value": Value? }

Value := { "lit": <hằng JSON> }
       | { "ctx": <khoá biến ngữ cảnh đã đăng ký> }
```

`{"all": []}` là cây rỗng — luôn `TRUE`, tức toàn phạm vi.

Không có nhánh nào gọi được phương thức, dựng được kiểu, hay tham chiếu được bean. Không có gì để inject.

### 3.2. Toán tử

| Toán tử | Toán hạng | Kiểu áp dụng | Phủ định |
| :--- | :--- | :--- | :--- |
| `eq` | 1 | mọi | `ne` |
| `ne` | 1 | mọi | `eq` |
| `in` | tập | mọi | `notIn` |
| `notIn` | tập | mọi | `in` |
| `lt` | 1 | số, ngày | `gte` |
| `lte` | 1 | số, ngày | `gt` |
| `gt` | 1 | số, ngày | `lte` |
| `gte` | 1 | số, ngày | `lt` |
| `between` | 2 | số, ngày | (khai triển thành `any[lt, gt]`) |
| `like` | 1 | chuỗi | `notLike` |
| `notLike` | 1 | chuỗi | `like` |
| `isNull` | **0** | trường nullable | `isNotNull` |
| `isNotNull` | **0** | trường nullable | `isNull` |

Cột "Phủ định" không phải trang trí — nó là bảng tra dùng cho việc chuẩn hoá cây ở §6.1.

`isNull`/`isNotNull` **không mang `value`**. Schema không được ép có toán hạng cho một toán tử không có toán hạng.

### 3.3. Biến ngữ cảnh

Khoá phải được đăng ký. Bean **chủ động tham gia**, không bị tra ra từ context:

```java
package com.dth.frw.shared.security.rowlevel;

public interface RowLevelContextProvider {
    /** Khoá dùng trong {"ctx": "..."}. Duy nhất toàn ứng dụng. */
    String key();

    /** Kiểu giá trị trả về, để kiểm kiểu lúc LƯU chính sách. */
    Class<?> type();

    /** Đọc từ cache. Không được truy vấn database. */
    Object resolve(RowLevelPrincipal principal);
}
```

Bộ dựng sẵn:

| Khoá | Kiểu | Nguồn |
| :--- | :--- | :--- |
| `user.id` | `Long` | `RowLevelPrincipal` |
| `user.organizationId` | `Long` | `RowLevelPrincipal` |
| `user.departmentId` | `Long` | `RowLevelPrincipal` |
| `user.roleCodes` | `Set<String>` | `RowLevelPrincipal` |
| `today` | `LocalDate` | đồng hồ server |
| `now` | `Instant` | đồng hồ server |

`today` và `now` phân giải **trên server**, cùng lý do `TaskSpecifications.overdueSpec` đã làm vậy: một trình duyệt ở múi giờ khác không được phép bất đồng với chính sách về việc hôm nay là ngày nào.

Thêm khoá của ứng dụng chỉ cần thêm một bean. Engine không phải sửa.

### 3.4. Logic ba trị — đặc tả bắt buộc

Đây là phần giữ cho hai trình biên dịch không bất đồng. SQL dùng ba trị, Java dùng hai trị; nếu không đặc tả thì `EntityEvaluator` sẽ chạy theo Java và cho kết quả khác `WHERE`.

```java
package com.dth.frw.shared.security.rowlevel;

public enum Tri {
    TRUE, FALSE, UNKNOWN;

    public Tri and(Tri other) { ... }
    public Tri or(Tri other)  { ... }
    public Tri negate()       { ... }
    public boolean isTrue()   { return this == TRUE; }
}
```

**Lá:**

| Tình huống | Kết quả |
| :--- | :--- |
| Trường là `null`, toán tử không phải `isNull`/`isNotNull` | `UNKNOWN` |
| Giá trị biến ngữ cảnh là `null`, toán tử không phải `isNull`/`isNotNull` | `UNKNOWN` |
| `in` với tập rỗng | `FALSE` |
| `notIn` với tập rỗng | `TRUE` |
| `isNull` / `isNotNull` | luôn `TRUE` hoặc `FALSE`, không bao giờ `UNKNOWN` |

Hai dòng về tập rỗng là **định nghĩa có chủ ý**, không phải hệ quả của SQL (SQL không viết được `x IN ()`). Lý do: một `RowLevelContextProvider` trả về tập rỗng — "người này không quản phòng nào" — phải cho ra "không thấy gì", chứ không phải một lỗi cú pháp.

**Nút — bảng chân trị Kleene:**

| | Cho `TRUE` khi | Cho `UNKNOWN` khi | Cho `FALSE` khi |
| :--- | :--- | :--- | :--- |
| `all` (AND) | tất cả `TRUE` | không có `FALSE` và có `UNKNOWN` | có ít nhất một `FALSE` |
| `any` (OR) | có ít nhất một `TRUE` | không có `TRUE` và có `UNKNOWN` | tất cả `FALSE` |
| `not` | vế trong `FALSE` | vế trong `UNKNOWN` | vế trong `TRUE` |

**Quy tắc chốt, ở cả hai trình biên dịch:**

> Một dòng được nhận **chỉ khi** kết quả là `TRUE`. `UNKNOWN` bị xử như từ chối.

Đó chính là hành vi của `WHERE` trong SQL, nên `PredicateCompiler` không phải làm gì thêm; và nó là thứ `EntityEvaluator` **phải** hiện thực.

**Hệ quả cần chấp nhận và giải thích cho người dùng:** `not(assignee.id = 42)` **không** nhận task chưa gán người. Muốn nhận thì viết ra:

```json
{ "any": [ { "not": { "field": "assignee.id", "op": "eq", "value": {"ctx":"user.id"} } },
           { "field": "assignee.id", "op": "isNull" } ] }
```

Trình dựng câu điều kiện ở màn hình quản trị **gợi ý nhánh `isNull`** mỗi khi người dùng đặt `not` lên một trường nullable. Rõ ràng hơn là để hai tầng đoán khác nhau.

---

## 4. CẤU TRÚC PACKAGE

Theo đúng quy ước feature-first của repo: entity vào `domain/`, slice tính năng vào `module/`, thứ mà **feature khác phải hiện thực** vào `shared/`.

```
com.dth.frw
├── shared/security/rowlevel/          ← primitives; feature khác implement/annotate
│   ├── RowLevelResource.java            @interface — đánh dấu entity
│   ├── RowLevelPolicySet.java           interface — mỗi feature khai một bean
│   ├── FieldDescriptor.java             record + factory (column/reference/id)
│   ├── DefaultScope.java                enum FULL | NONE
│   ├── Action.java                      enum READ | WRITE | DELETE
│   ├── ScopeTree.java                   sealed interface: All, Any, Not, Leaf
│   ├── Op.java                          enum toán tử §3.2, kèm negate()
│   ├── Tri.java                         enum ba trị §3.4
│   ├── RowLevelContextProvider.java     interface
│   ├── RowLevelPrincipal.java           record
│   ├── RowLevelViolationException.java  → 422
│   └── RowLevelPoliciesChanged.java     sealed interface — sự kiện bất biến hoá
│
├── shared/data/
│   └── SecuredRepository.java           repository base KHÔNG có findById (§7.1)
│
├── domain/security/rowlevel/
│   ├── RowLevelPolicy.java              @Entity — chính sách runtime
│   ├── PolicyKind.java                  enum SCOPE | FILTER
│   └── RowLevelPolicyAudit.java         @Entity — vết thay đổi
│
├── module/security/rowlevel/
│   ├── api/
│   │   ├── RowLevelPolicyController.java
│   │   └── dto/  RowLevelPolicyRequest, RowLevelPolicyPatchRequest,
│   │             RowLevelPolicyResponse, PolicyMetadataResponse,
│   │             ExplainResponse, SimulateRequest, SimulateResponse,
│   │             CoverageResponse, RoleRef
│   ├── service/
│   │   ├── RowLevelSecurity.java        ← FACADE mà mọi feature gọi
│   │   ├── RowLevelPolicyService.java   CRUD + audit + phát sự kiện
│   │   ├── RowLevelPolicyCache.java     nạp toàn bộ, biên dịch, generation
│   │   ├── RowLevelPolicyChannel.java   liên node qua PostgresEventBus
│   │   ├── PolicyCompiler.java          ScopeTree → ScopePlan (NNF, ép kiểu)
│   │   ├── PredicateCompiler.java       ScopePlan → Specification
│   │   ├── EntityEvaluator.java         ScopePlan → Tri
│   │   ├── RowLevelPrincipalResolver.java
│   │   ├── RowLevelMetadataValidator.java
│   │   └── RowLevelHealthIndicator.java
│   └── repo/
│       ├── RowLevelPolicyRepository.java
│       └── RowLevelPolicySpecifications.java
│
└── module/bpm/task/security/
    └── TaskRowLevelPolicies.java        ← khai báo của feature tasks
```

**Vì sao chia như vậy.** `TaskRowLevelPolicies` nằm trong slice `task` vì chính sách của một feature thuộc về feature đó. Nó implement `RowLevelPolicySet` ở `shared/` nên slice `task` **không** phụ thuộc vào slice `rowlevel`. Chiều ngược lại, `TaskService` gọi `RowLevelSecurity` ở `module/security/rowlevel/service/` — đúng quy tắc "một feature với tới feature khác qua `service/`, không bao giờ qua `repo/`", giống hệt cách `TaskService` đang gọi `UserService` và `NotificationService`.

---

## 5. KHAI BÁO PHÍA FEATURE

### 5.1. Đánh dấu entity

```java
package com.dth.frw.domain.bpm.task;

@RowLevelResource("tasks")     // trùng tên resource trong routes.tsx
@Entity
@Table(name = "tasks")
public class Task { ... }
```

### 5.2. Tập trường và `defaultScope`

Chính sách không được trỏ vào một trường tuỳ ý. Tập trường là **đóng** và khai báo tách khỏi entity — entity là mô hình dữ liệu, không phải nơi chứa chính sách.

```java
package com.dth.frw.module.bpm.task.security;

@Component
public class TaskRowLevelPolicies implements RowLevelPolicySet<Task> {

    @Override public String resource() { return "tasks"; }

    /**
     * FULL: tasks đang chạy và đã có dữ liệu. Bật row-level lên không đổi
     * hành vi của ai — không cần migration seed nào. Đổi sang NONE khi cả
     * ba role đã có SCOPE (theo dõi bằng ma trận phủ, §13.4).
     */
    @Override public DefaultScope defaultScope() { return DefaultScope.FULL; }

    @Override public List<FieldDescriptor> fields() {
        return List.of(
            FieldDescriptor.id("id"),
            FieldDescriptor.column("status",   TaskStatus.class),
            FieldDescriptor.column("priority", TaskPriority.class),
            FieldDescriptor.column("dueDate",  LocalDate.class),
            FieldDescriptor.column("createdAt", Instant.class),
            // Quan hệ to-one. Khai báo ở đây để (a) biên dịch ra EXISTS đúng
            // bảng, (b) đường đọc biết phải fetch sẵn gì cho EntityEvaluator.
            FieldDescriptor.reference("assignee",   User.class),
            FieldDescriptor.reference("department", Department.class),
            FieldDescriptor.reference("createdBy",  User.class)
        );
    }

    /**
     * Trường KHÔNG dùng được trong chính sách `write`, vì giá trị chỉ có sau
     * khi flush. Bị TỪ CHỐI NGAY TẠI API LƯU CHÍNH SÁCH, kèm lý do — chứ
     * không để người ta phát hiện qua một lần tạo mới bị từ chối vô cớ.
     */
    @Override public Set<String> notCheckSafe() {
        return Set.of("id", "createdAt", "updatedAt", "completedAt");
    }

    /**
     * FILTER khai báo trong mã nguồn: bất biến nghiệp vụ, không phải cấu
     * hình. Không hiện nút xoá trên UI; hiện ở chế độ chỉ đọc với nhãn
     * "khai báo trong mã nguồn", để người quản trị nhìn thấy TOÀN BỘ chính
     * sách đang áp dụng chứ không chỉ nửa mà họ sửa được.
     */
    @Override public List<DesignTimeFilter<Task>> filters() {
        return List.of();   // tasks chưa cần
    }

    /** SCOPE khai báo trong mã nguồn, cho luật không nên tắt được từ UI. */
    @Override public List<DesignTimeScope<Task>> scopes() {
        return List.of();   // tasks dùng chính sách runtime
    }
}
```

### 5.3. `FieldDescriptor`

```java
public record FieldDescriptor(
        String path,          // "status", "department" (to-one), "department.id"
        Class<?> type,
        boolean nullable,
        Kind kind,            // COLUMN | REFERENCE | ID
        Set<Op> operators) {

    public enum Kind { COLUMN, REFERENCE, ID }

    public static FieldDescriptor column(String path, Class<?> type) { ... }
    public static FieldDescriptor reference(String path, Class<?> target) { ... }
    public static FieldDescriptor id(String path) { ... }
}
```

Bốn thứ và cả bốn đều cần:

| Thuộc tính | Dùng để |
| :--- | :--- |
| `path` | đường truy cập, cho phép dấu chấm |
| `type` | **ép kiểu giá trị lúc LƯU chính sách**, không phải lúc chạy |
| `nullable` | quyết định `isNull`/`isNotNull` có hợp lệ không, và cảnh báo `not` ở §3.4 |
| `kind` | `REFERENCE` ⇒ biên dịch thành `EXISTS`; `COLUMN` ⇒ so sánh thẳng trên root |

Với `reference("department", Department.class)`, chính sách viết `"field": "department.id"`. Trình biên dịch tách `department` (reference) khỏi `id` (thuộc tính của đích).

### 5.4. Design-time và runtime

| | Design-time | Runtime |
| :--- | :--- | :--- |
| Ở đâu | `RowLevelPolicySet` bean, trong version control | bảng `row_level_policy`, sửa qua UI |
| Dành cho | bất biến nghiệp vụ; `FILTER`; luật mà một `@PreAuthorize` phụ thuộc vào | phạm vi theo tổ chức, đổi khi công ty tái cấu trúc |
| Biểu đạt | **`Specification<T>` Java thuần** + một `Tri` predicate song song — subquery, join, gọi bean tuỳ ý | **`ScopeTree`** — từ vựng đóng |
| Sửa từ UI | không | có, có audit |
| Tắt được | không | có (`enabled = false`) |

Đây là chỗ giải quyết mâu thuẫn *"cần biểu đạt mạnh"* và *"không được có RCE"*: **biểu đạt mạnh ở nơi là mã nguồn** (được review, được test, deploy cùng code phụ thuộc vào nó) và **từ vựng đóng ở nơi là dữ liệu** (màn hình quản trị). Không cần một ngôn ngữ script ở runtime, và do đó không cần một công tắc tắt nó.

Design-time policy phải cung cấp **cả hai** dạng (`Specification` và `Tri` predicate) và có test đối chiếu riêng, vì trình biên dịch không sinh giúp được — đó là cái giá của việc viết tay, và nó được tính vào checklist ở §16.

---

## 6. BIÊN DỊCH

```
  ScopeTree (JSONB) hoặc DesignTimeScope (Java)
              │
              │  PolicyCompiler — chạy MỘT LẦN lúc nạp cache
              │   · chuẩn hoá về NNF (§6.1)
              │   · phân giải field theo FieldDescriptor
              │   · ép kiểu literal về type của field
              │   · gắn ContextProvider cho mỗi {"ctx": ...}
              ▼
          ScopePlan  (bất biến, đã kiểm, không còn chuỗi tự do)
         ╱                 ╲
        ▼                   ▼
  PredicateCompiler     EntityEvaluator
   → Specification<T>    → Tri
   (WHERE của SQL)       (WITH CHECK, cờ _can, che tóm tắt nhúng)
```

### 6.1. Chuẩn hoá NNF — quy tắc quan trọng nhất của mục này

**`ScopePlan` không bao giờ chứa `not` ở nút trong. `not` chỉ tồn tại ở lá, và được hấp thụ vào toán tử.**

Chuyển đổi (De Morgan, hợp lệ trong logic Kleene ba trị):

```
not(all[a, b])   →  any[not a, not b]
not(any[a, b])   →  all[not a, not b]
not(not a)       →  a
not(leaf op v)   →  leaf op.negate() v          (bảng phủ định §3.2)
```

**Vì sao bắt buộc.** Điều kiện trên quan hệ được biên dịch thành `EXISTS` (§6.2), mà `EXISTS` trong SQL là **hai trị** — nó không bao giờ trả `UNKNOWN`. Nếu để `not` bọc ngoài:

```sql
NOT EXISTS (SELECT 1 FROM departments d WHERE d.id = t.department_id AND d.id = ?)
```

thì một task có `department_id IS NULL` cho `EXISTS = false` ⇒ `NOT EXISTS = true` ⇒ **dòng được nhận**. Trong khi ngữ nghĩa ba trị nói `UNKNOWN` ⇒ loại. Hai trình biên dịch bất đồng ngay tại đây.

Sau NNF, `not` nằm **bên trong** `EXISTS`:

```sql
EXISTS (SELECT 1 FROM departments d WHERE d.id = t.department_id AND d.id <> ?)
```

`department_id IS NULL` ⇒ subquery rỗng ⇒ `EXISTS = false` ⇒ loại dòng. Khớp `UNKNOWN`. ✔

Đây là một dòng mã nhỏ với hậu quả bảo mật lớn, và là thứ test đối chiếu ở §16 tồn tại để canh.

### 6.2. `PredicateCompiler` — `EXISTS`, không sinh JOIN

**Quy tắc: mọi điều kiện không nằm trên chính root đều biên dịch thành `EXISTS` tương quan. Không sinh JOIN nào.**

Lá trên root (`kind = COLUMN | ID`):

```java
// { "field": "status", "op": "eq", "value": {"lit": "TODO"} }
cb.equal(root.get("status"), TaskStatus.TODO)
```

Lá trên quan hệ (`kind = REFERENCE`):

```java
// { "field": "department.id", "op": "eq", "value": {"ctx": "user.departmentId"} }
Subquery<Integer> sub = query.subquery(Integer.class);
Root<Department> d = sub.from(Department.class);
sub.select(cb.literal(1))
   .where(cb.equal(d, root.get("department")),      // tương quan
          cb.equal(d.get("id"), resolvedValue));    // điều kiện (đã qua NNF)
return cb.exists(sub);
```

Bốn thứ đạt được cùng lúc:

| | |
| :--- | :--- |
| **Không có INNER/LEFT để chọn sai** | Cái bẫy mà `TaskSpecifications.relationSpec` phải ghi chú — `root.get("assignee").get("id")` để JPA tự thêm INNER JOIN, nuốt mất mọi dòng có khoá ngoại `NULL` — đơn giản là không còn tồn tại |
| **Không nhân dòng** | `Page.getTotalElements()` và `X-Total-Count` chính xác, không cần `distinct` |
| **Câu `COUNT` riêng của Spring Data giữ đúng ngữ nghĩa** | Nó không phải mang theo join nào |
| **Ánh xạ 1–1 sang `EntityEvaluator`** | `EXISTS` trên to-one = "đọc association rồi so sánh", đúng thứ trình đánh giá in-memory làm |

Chi phí: một subquery tương quan trên khoá ngoại đã có index (`idx_tasks_department_id`, `idx_tasks_assignee_id`, `idx_tasks_created_by_id` đều đã tồn tại từ changeset `013`). PostgreSQL thường viết lại thành semi-join, nên kế hoạch thực thi tương đương join.

Quan hệ to-many (chưa dùng): cũng là `EXISTS`, và đây là lý do thứ năm — join to-many nhân dòng lên và làm hỏng phân trang.

### 6.3. Ánh xạ toán tử

| `Op` | `PredicateCompiler` | `EntityEvaluator` (sau khi đã xử `null` → `UNKNOWN`) |
| :--- | :--- | :--- |
| `eq` | `cb.equal(x, v)` | `Objects.equals(a, v)` |
| `ne` | `cb.notEqual(x, v)` | `!Objects.equals(a, v)` |
| `in` | `x.in(coll)` (rỗng → `cb.disjunction()`) | `coll.contains(a)` (rỗng → `FALSE`) |
| `notIn` | `cb.not(x.in(coll))` (rỗng → `cb.conjunction()`) | `!coll.contains(a)` (rỗng → `TRUE`) |
| `lt` / `lte` / `gt` / `gte` | `cb.lessThan` … | `compareTo` |
| `like` | `cb.like(cb.lower(x), pattern)` | `a.toLowerCase().contains(...)` |
| `notLike` | `cb.notLike(cb.lower(x), pattern)` | `!a.toLowerCase().contains(...)` |
| `isNull` | `cb.isNull(x)` | `a == null` → `TRUE`/`FALSE`, không bao giờ `UNKNOWN` |
| `isNotNull` | `cb.isNotNull(x)` | `a != null` |

`between` được `PolicyCompiler` khai triển thành `all[gte, lte]` trước khi tới đây, nên hai trình biên dịch không phải xử lý riêng.

### 6.4. `EntityEvaluator`

```java
public Tri evaluate(ScopePlan plan, Object entity, RowLevelPrincipal principal);
```

Đọc trường qua `PropertyAccessor` theo `path`. **Không truy vấn.** Ba chỗ dùng, và chỉ ba chỗ:

1. `WITH CHECK` khi ghi (§8)
2. Cờ `_can` trên mỗi dòng trả về UI (§14.1)
3. Che tóm tắt nhúng trong payload (§9)

**Quy tắc chốt:** đánh giá in-memory **không bao giờ** dùng làm bộ lọc chính của một danh sách. Đó là việc của SQL. Dùng sai chỗ này là N+1 nhân với số dòng.

---

## 7. ĐIỂM CHẶN

### 7.1. `SecuredRepository` — bỏ hẳn API không an toàn

Nguyên tắc 6: không thể quên thứ không tồn tại.

```java
package com.dth.frw.shared.data;

/**
 * Repository cho entity chịu quản lý dòng.
 *
 * <p>KHÔNG kế thừa {@code CrudRepository}/{@code JpaRepository}. Hệ quả:
 * {@code findById}, {@code findAll()}, {@code findAllById}, {@code count()},
 * {@code existsById}, {@code getReferenceById} và mọi derived query
 * KHÔNG TỒN TẠI để mà gọi nhầm.
 *
 * <p>{@code JpaSpecificationExecutor} chỉ cấp các phương thức nhận
 * {@code Specification}, nên mọi đường đọc buộc phải đi qua một phạm vi.
 *
 * <p>Muốn một đường đọc không giới hạn thì phải khai báo thêm một phương
 * thức trên interface con — và một phương thức mới trên repository chịu
 * quản lý dòng là thứ nhìn thấy được khi review, khác hẳn với việc gọi một
 * phương thức kế thừa sẵn.
 */
@NoRepositoryBean
public interface SecuredRepository<T, ID> extends Repository<T, ID>, JpaSpecificationExecutor<T> {

    <S extends T> S persist(S entity);

    void remove(T entity);

    void flush();
}
```

Hiện thực bằng một `SecuredRepositoryImpl` mỏng kế thừa `SimpleJpaRepository` (chỉ để tái dùng `save`/`delete`/`flush`), đăng ký qua `@EnableJpaRepositories(repositoryBaseClass = ...)`. **Lớp base không chứa một dòng logic phân quyền nào** — nó chỉ cung cấp ba phương thức ghi; việc lọc nằm ở `Specification`, việc kiểm ghi nằm ở service.

Đó là khác biệt then chốt so với cách ghi đè `SimpleJpaRepository` để "tự động lọc": cách đó chỉ bịt được vài phương thức, và trong codebase này thì bịt đúng những phương thức không ai gọi.

### 7.2. `RowLevelSecurity` — facade

```java
package com.dth.frw.module.security.rowlevel.service;

public interface RowLevelSecurity {

    /** Phạm vi cho một (entity, action). Toàn phạm vi khi không có principal. */
    <T> Specification<T> scope(Class<T> entityClass, Action action);

    /** scope(...) AND id = ? — cho get/update/delete. */
    <T> Specification<T> byId(Class<T> entityClass, Action action, Object id);

    /** scope(...) AND id IN (?) — cho getMany. */
    <T> Specification<T> byIds(Class<T> entityClass, Action action, Collection<?> ids);

    /** WITH CHECK. Ném RowLevelViolationException khi trạng thái mới ngoài phạm vi. */
    void checkWritable(Object entity);

    /** Cờ cho UI: USING ∧ WITH CHECK trên trạng thái hiện tại. */
    Map<String, Boolean> capabilities(Object entity);

    /** Có được đọc dòng này không — dùng để che tóm tắt nhúng (§9). */
    boolean canRead(Object entity);

    /** Cửa thoát tường minh. Log INFO + counter Micrometer. */
    <R> R asSystem(String taskName, Supplier<R> work);
    void asSystem(String taskName, Runnable work);
}
```

### 7.3. Đường đọc — thay đổi cụ thể ở `TaskService`

**Trước:**

```java
public Page<Task> list(ListParams params) {
    return repository.findAll(TaskSpecifications.from(params),
                              params.pageable(SORTABLE, DEFAULT_SORT));
}

public Task get(Long id) {
    return repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Task", id));
}

public List<Task> getMany(List<Long> ids) {
    return repository.findAllById(ids);
}
```

**Sau:**

```java
public Page<Task> list(ListParams params) {
    return repository.findAll(
            rowLevel.scope(Task.class, Action.READ)          // phạm vi TRƯỚC
                    .and(TaskSpecifications.from(params)),   // bộ lọc người dùng SAU
            params.pageable(SORTABLE, DEFAULT_SORT));
}

public Task get(Long id) {
    return repository.findOne(rowLevel.byId(Task.class, Action.READ, id))
            .orElseThrow(() -> new ResourceNotFoundException("Task", id));
}

public List<Task> getMany(List<Long> ids) {
    return repository.findAll(rowLevel.byIds(Task.class, Action.READ, ids));
}
```

Ba điểm:

- **Phạm vi luôn `.and(...)` trước bộ lọc người dùng.** `Specification.and` không có phép trừ, nên không query string nào nới rộng được nó.
- **`get` trả `404`, không phải `403`.** Dòng ngoài phạm vi **không tồn tại** với người gọi. Không cho dò sự tồn tại của id — đúng lập trường mà `NotificationService` đã thiết lập và `CLAUDE.md` đã ghi.
- **`getMany` trả về ít phần tử hơn số id được hỏi.** Refine dùng `getMany` để phân giải nhãn khoá ngoại, nên phần tử vắng mặt hiện thành ô trống; §14.3 xử lý bằng nhãn dự phòng. Đây là hành vi **đúng**, không phải khiếm khuyết.

### 7.4. Đường hệ thống

`AuthorityCache.load` gọi `UserService.get`; tác vụ theo lịch; luồng đăng nhập. Những đường này chạy ngoài ngữ cảnh người dùng.

`scope(...)` trả `Specification.unrestricted()` khi `SecurityContextHolder` không có principal — không `NullPointerException`, và không đệ quy khi `users` được đưa vào diện quản lý.

Bỏ qua phạm vi **có chủ đích** phải là một câu lệnh đọc được, và phải để lại dấu vết:

```java
rowLevel.asSystem("nightly-overdue-sweep", () -> { ... });
```

Log mức **`INFO`** kèm tên tác vụ, và đếm vào counter `rowlevel.bypass{task=...}` của Micrometer. Mức `DEBUG` là không đủ: trong production một lần bỏ qua phân quyền sẽ không để lại gì.

---

## 8. VÒNG ĐỜI GHI

### 8.1. `update` — USING rồi WITH CHECK

```java
@Transactional
public Task update(Long id, TaskPatchRequest request) {
    // USING trên trạng thái cũ. Ngoài phạm vi → 404, không phân biệt với
    // "không tồn tại".
    Task task = repository.findOne(rowLevel.byId(Task.class, Action.WRITE, id))
            .orElseThrow(() -> new ResourceNotFoundException("Task", id));

    User previousAssignee = task.getAssignee();
    TaskStatus previousStatus = task.getStatus();

    /* ... áp patch, không đổi ... */
    applyCompletion(task, previousStatus);

    // WITH CHECK trên trạng thái mới, trong bộ nhớ, 0 câu SQL.
    // Đây là thứ chặn việc đổi department sang phòng khác để giấu dòng.
    rowLevel.checkWritable(task);

    Task saved = repository.persist(task);
    announceAssignment(saved, previousAssignee);
    return saved;
}
```

Entity đem ghi **chính là** entity đã đọc qua phạm vi — chỉ có một thực thể trong persistence context. Đọc một bản để kiểm rồi `save` một bản detached khác lên cùng khoá sẽ cho `NonUniqueObjectException`, hoặc tệ hơn là ghi đè im lặng bằng bản detached.

### 8.2. `create` — WITH CHECK **sau** `flush()`

```java
@Transactional
public Task create(TaskRequest request) {
    Task task = /* ... dựng, không đổi ... */;

    Task saved = repository.persist(task);
    repository.flush();               // @PrePersist đã chạy, identity đã sinh
    rowLevel.checkWritable(saved);    // trượt → ném → rollback toàn bộ

    announceAssignment(saved, null);
    return saved;
}
```

**Vì sao phải sau `flush()`.** Trước đó `id` còn `null` (identity sinh lúc flush) và `createdAt` còn `null` (`@PrePersist` chưa chạy). Đánh giá chính sách trên một entity chưa hoàn chỉnh là **sai ở mọi trường hợp** — một chính sách vô hại như `createdAt >= today` sẽ từ chối mọi lần tạo mới.

Hai lớp bảo vệ, và cần cả hai:

1. `notCheckSafe` (§5.2) **cấm** chính sách `write` chạm những trường đó ngay từ lúc lưu, kèm thông điệp giải thích.
2. `checkWritable` vẫn chạy sau `flush()`, phòng trường hợp một trường sinh ở tầng database mà `notCheckSafe` chưa liệt kê.

Ném sau flush là an toàn: ngoại lệ đánh dấu transaction rollback-only nên dòng vừa `INSERT` bị huỷ. Cái giá là một `INSERT` lãng phí khi bị từ chối — chấp nhận được vì bị từ chối là trường hợp hiếm.

### 8.3. `delete` — chỉ USING

```java
@Transactional
public Task delete(Long id) {
    Task task = repository.findOne(rowLevel.byId(Task.class, Action.DELETE, id))
            .orElseThrow(() -> new ResourceNotFoundException("Task", id));
    repository.remove(task);
    return task;   // controller echo lại — data provider parse body của DELETE
}
```

### 8.4. Mã lỗi

`ApiExceptionHandler` thêm một handler:

```java
@ExceptionHandler(RowLevelViolationException.class)
public ResponseEntity<Map<String, Object>> handleRowLevel(RowLevelViolationException e) {
    return body(HttpStatus.UNPROCESSABLE_CONTENT, e.getMessage(), Map.of());
}
```

**`422`, không phải `403` hay `404`** — cùng mã mà handler đang dùng cho `MethodArgumentNotValidException` và `ConstraintViolationException`, và đúng ngữ nghĩa: bản ghi *có* tồn tại với người gọi, yêu cầu *có* nghĩa; thứ bị từ chối là **trạng thái đích**.

Thông điệp nêu **tên trường** đã đẩy dòng ra khỏi phạm vi, không nêu nội dung chính sách:

> `Không thể lưu: trường "department" đưa bản ghi ra ngoài phạm vi dữ liệu của bạn.`

### 8.5. Ghi hàng loạt

Không có API riêng. `saveAll` không được gọi ở đâu trong codebase này, nên không thiết kế cho nó. Khi cần: **toàn bộ hoặc không gì cả**, mỗi dòng qua `checkWritable`, một ngoại lệ rollback cả lô. Ghi một phần bên trong một transaction là một lời nói dối về tính nguyên tử.

---

## 9. DỮ LIỆU LỒNG TRONG PAYLOAD

`TaskResponse` nhúng tóm tắt `assignee` và `department`. Phạm vi dòng lọc **gốc** của resource đang được phục vụ; nó không tự lan xuống các tóm tắt nhúng.

Giải pháp: dùng `EntityEvaluator` — công cụ đã có sẵn — để che.

```java
public static TaskResponse from(Task task, RowLevelSecurity rowLevel) {
    return new TaskResponse(
        task.getId(),
        task.getTitle(),
        ...
        // Nếu users chịu quản lý dòng và assignee ngoài phạm vi đọc của người
        // gọi, trả null kèm cờ, để client hiện "—" thay vì một ô trống khó hiểu.
        summarize(task.getAssignee(), rowLevel),
        summarize(task.getDepartment(), rowLevel),
        rowLevel.capabilities(task)      // → "_can"
    );
}
```

Hai ràng buộc, cả hai bắt buộc:

**Một — association phải được fetch sẵn.** `RowLevelPolicySet.fields()` đã liệt kê chúng qua `reference(...)`, nên `rowLevel.fetchHints(Task.class)` trả về đúng danh sách đó và đường đọc dùng nó làm entity graph. Với `Task` hiện tại mọi association đã `EAGER` nên không đổi gì; với một entity `LAZY` thì đây là thứ ngăn N+1. **Không có fetch hint thì không phát cờ** — fail-fast, thay vì suy giảm hiệu năng âm thầm.

**Hai — chỉ áp cho resource cũng chịu quản lý.** `summarize` gọi `rowLevel.canRead` chỉ khi lớp của đối tượng có `@RowLevelResource`. Ngược lại trả tóm tắt như cũ, không tốn gì.

---

## 10. MÔ HÌNH DỮ LIỆU

Liquibase sở hữu schema (`ddl-auto=validate`). Hai changeset, đăng ký trong `db.changelog-master.yaml`:

```yaml
  - include:
      file: db/changelog/changes/015-create-row-level-policies.yaml
  - include:
      file: db/changelog/changes/016-seed-row-level-permissions.sql
```

**`016` chỉ seed ba mã quyền quản trị. Không seed một dòng chính sách nào** — `defaultScope = FULL` khai trong mã nguồn đã lo việc "bật lên là no-op", nên không cần bảng nào phải đồng bộ với `role_permissions`.

### 10.1. `015-create-row-level-policies.yaml`

```yaml
# Chính sách phân quyền dòng dữ liệu, sửa được lúc chạy.
#
# SCOPE gắn với một role và HỢP với nhau: thêm role chỉ nới rộng.
# FILTER không gắn role và GIAO với mọi thứ: một lệnh cấm không né được
# bằng cách không có role nào đó.
databaseChangeLog:
  - changeSet:
      id: 015-create-row-level-policies
      author: dth
      changes:
        - createTable:
            tableName: row_level_policy
            columns:
              - column:
                  name: id
                  type: bigint
                  autoIncrement: true
                  constraints:
                    primaryKey: true
                    primaryKeyName: pk_row_level_policy
              - column:
                  name: kind
                  type: varchar(8)          # SCOPE | FILTER
                  constraints:
                    nullable: false
              # NULL khi kind = FILTER. Ràng buộc ck_rlp_kind bên dưới giữ
              # cho hai loại không lẫn vào nhau.
              - column:
                  name: role_id
                  type: bigint
              - column:
                  name: resource
                  type: varchar(64)
                  constraints:
                    nullable: false
              - column:
                  name: action
                  type: varchar(16)         # read | write | delete
                  constraints:
                    nullable: false
              - column:
                  name: name
                  type: varchar(160)
                  constraints:
                    nullable: false
              # Gom nhóm để hiển thị trên màn hình quản trị.
              - column:
                  name: policy_group
                  type: varchar(64)
              - column:
                  name: description
                  type: varchar(500)
              # Cây điều kiện. {"all":[]} là cây rỗng = toàn phạm vi.
              - column:
                  name: scope
                  type: jsonb
                  constraints:
                    nullable: false
              - column:
                  name: enabled
                  type: boolean
                  defaultValueBoolean: true
                  constraints:
                    nullable: false
              # Điền khi bị cách ly lúc khởi động vì không còn hợp lệ.
              - column:
                  name: invalid_reason
                  type: varchar(500)
              - column:
                  name: created_by_id
                  type: bigint
              - column:
                  name: updated_by_id
                  type: bigint
              - column:
                  name: created_at
                  type: timestamp with time zone
                  constraints:
                    nullable: false
              - column:
                  name: updated_at
                  type: timestamp with time zone

        # CASCADE là ngoại lệ có chủ ý so với RESTRICT ở phần còn lại của
        # schema: một chính sách mồ côi không phải dữ liệu cần giữ, nó là một
        # mảnh chính sách vô nghĩa.
        - addForeignKeyConstraint:
            baseTableName: row_level_policy
            baseColumnNames: role_id
            constraintName: fk_rlp_role
            referencedTableName: roles
            referencedColumnNames: id
            onDelete: CASCADE
        # SET NULL, cùng lý do với tasks.created_by_id: biết ai đặt chính sách
        # là thông tin đáng giữ, nhưng không đáng để từ chối xoá tài khoản của
        # một người đã nghỉ.
        - addForeignKeyConstraint:
            baseTableName: row_level_policy
            baseColumnNames: created_by_id
            constraintName: fk_rlp_created_by
            referencedTableName: users
            referencedColumnNames: id
            onDelete: SET NULL
        - addForeignKeyConstraint:
            baseTableName: row_level_policy
            baseColumnNames: updated_by_id
            constraintName: fk_rlp_updated_by
            referencedTableName: users
            referencedColumnNames: id
            onDelete: SET NULL

        - sql:
            comment: SCOPE gắn với một role; FILTER thì không gắn role nào.
            sql: >
              ALTER TABLE row_level_policy ADD CONSTRAINT ck_rlp_kind CHECK (
                (kind = 'SCOPE'  AND role_id IS NOT NULL) OR
                (kind = 'FILTER' AND role_id IS NULL))

        # Cache nạp toàn bộ bảng theo (resource, action); index chỉ phục vụ
        # lần nạp lại sau mỗi thay đổi.
        - createIndex:
            tableName: row_level_policy
            indexName: idx_rlp_resource_action
            columns:
              - column:
                  name: resource
              - column:
                  name: action
        - createIndex:
            tableName: row_level_policy
            indexName: idx_rlp_role_id
            columns:
              - column:
                  name: role_id

        # Vết thay đổi. Chỉ ghi thêm, không sửa, không xoá — và CỐ TÌNH không
        # có khoá ngoại tới row_level_policy, vì vết của một chính sách đã bị
        # xoá là vết quan trọng nhất.
        - createTable:
            tableName: row_level_policy_audit
            columns:
              - column:
                  name: id
                  type: bigint
                  autoIncrement: true
                  constraints:
                    primaryKey: true
                    primaryKeyName: pk_row_level_policy_audit
              - column:
                  name: policy_id
                  type: bigint
                  constraints:
                    nullable: false
              - column:
                  name: operation
                  type: varchar(16)   # CREATE|UPDATE|DELETE|ENABLE|DISABLE|QUARANTINE
                  constraints:
                    nullable: false
              - column:
                  name: before_state
                  type: jsonb
              - column:
                  name: after_state
                  type: jsonb
              - column:
                  name: actor_id
                  type: bigint
              # Chụp lại tên, để còn đọc được khi tài khoản đã bị xoá.
              - column:
                  name: actor_name
                  type: varchar(100)
                  constraints:
                    nullable: false
              - column:
                  name: occurred_at
                  type: timestamp with time zone
                  constraints:
                    nullable: false
        - addForeignKeyConstraint:
            baseTableName: row_level_policy_audit
            baseColumnNames: actor_id
            constraintName: fk_rlp_audit_actor
            referencedTableName: users
            referencedColumnNames: id
            onDelete: SET NULL
        - createIndex:
            tableName: row_level_policy_audit
            indexName: idx_rlp_audit_policy
            columns:
              - column:
                  name: policy_id
              - column:
                  name: occurred_at
                  descending: true
```

**Không có `CHECK` trên `action`.** Giá trị được kiểm với registry trong mã — nơi đã là nguồn sự thật — nên thêm một action mới không cần migration.

**Không có ràng buộc duy nhất trên `(role_id, resource, action)`.** Nhiều `SCOPE` cho cùng một role là hợp lệ và vô hại: chúng `OR` với nhau, nên một dòng thừa chỉ nới rộng đúng bằng chính nó.

### 10.2. `016-seed-row-level-permissions.sql`

```sql
--liquibase formatted sql

--changeset dth:016-seed-row-level-permissions
--comment Permissions for the row_level_policies resource. No policy rows are seeded.

INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('row_level_policies:read',   'View data scopes',   'See which rows each role may reach', TRUE),
  ('row_level_policies:write',  'Edit data scopes',   'Narrow or widen a role''s data scope', TRUE),
  ('row_level_policies:delete', 'Delete data scopes', 'Remove a data scope policy',          TRUE);

-- Spelled out for ADMIN, like 007, 010 and 014: 005 granted ADMIN every
-- permission that existed *when it ran*, so a code added later reaches nobody
-- until a migration says so. Nobody but ADMIN gets these: editing a data scope
-- is editing the security model.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('row_level_policies:read',
                                 'row_level_policies:write',
                                 'row_level_policies:delete')
WHERE r.code = 'ADMIN';

-- No row_level_policy rows are inserted, deliberately. Each resource declares
-- its own DefaultScope in code (RowLevelPolicySet.defaultScope), so switching a
-- running resource on is a no-op without any seed data to keep in step with
-- role_permissions.

--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code LIKE 'row_level_policies:%');
--rollback DELETE FROM permissions WHERE code LIKE 'row_level_policies:%';
```

### 10.3. Entity

```java
package com.dth.frw.domain.security.rowlevel;

@Entity
@Table(name = "row_level_policy")
public class RowLevelPolicy {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 8)
    private PolicyKind kind;

    @ManyToOne(fetch = FetchType.EAGER)          // null khi FILTER
    @JoinColumn(name = "role_id")
    private Role role;

    @Column(nullable = false, length = 64)  private String resource;
    @Column(nullable = false, length = 16)  private String action;
    @Column(nullable = false, length = 160) private String name;
    @Column(name = "policy_group", length = 64) private String policyGroup;
    @Column(length = 500) private String description;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String scope;

    @Column(nullable = false) private boolean enabled = true;
    @Column(name = "invalid_reason", length = 500) private String invalidReason;
    ...
}
```

---

## 11. CACHE VÀ LAN TRUYỀN

Sao chép nguyên mô hình `AuthorityCache` — cùng cấu trúc, cùng sự kiện, cùng bus. **Không thêm Redis:** `PostgresEventBus` đã làm đúng việc này, và thêm một broker là thêm một hạ tầng phải vận hành và phải chịu lỗi độc lập.

### 11.1. `RowLevelPolicyCache`

```java
@Component
public class RowLevelPolicyCache {

    private volatile Snapshot snapshot;   // tráo con trỏ, không sửa tại chỗ

    public record Snapshot(
            Map<Key, List<CompiledPolicy>> byResourceAction,
            String generation,            // hash toàn bộ tập chính sách đang bật
            long loadedAt) {}

    public record Key(String resource, String action) {}
    public record CompiledPolicy(Long policyId, PolicyKind kind, Long roleId, ScopePlan plan) {}
}
```

- **Nạp toàn bộ, không nạp theo khoá.** Dữ liệu chính sách nhỏ (hàng chục đến hàng trăm dòng) và mọi truy vấn cần nó. Nạp cả bảng, biên dịch cả bảng thành `ScopePlan` bất biến, giữ trong một `volatile` reference. Bất biến hoá trở thành **"nạp lại tất cả và tráo con trỏ"** — không có eviction từng phần để sai một cách tinh vi.
- TTL **60 giây** làm lưới an toàn cuối, cùng con số và cùng lý do đã ghi cho `AuthorityCache`: một đường ai đó quên phát sự kiện sẽ suy biến thành *"sai trong một phút"*, không phải *"sai đến lần khởi động sau"*.

### 11.2. Bất biến hoá

```java
package com.dth.frw.shared.security.rowlevel;

public sealed interface RowLevelPoliciesChanged {
    record Changed() implements RowLevelPoliciesChanged {}
}
```

```java
@Order(0)
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
public void onLocalChange(RowLevelPoliciesChanged change) { reload(); }

@Order(0)
@EventListener
public void onRemoteChange(RowLevelPolicyChannel.Received received) { reload(); }
```

Hai lý do y hệt `AuthoritiesChanged`, và cả hai đều bắt buộc:

- **`AFTER_COMMIT`** — nạp lại trước khi commit sẽ để một request song song đọc lại đúng những dòng sắp đổi.
- **`fallbackExecution = true`** — không có nó, một publisher không nằm trong transaction bị nuốt trong im lặng, và đó là kiểu hỏng tệ nhất có thể có cho một cơ chế bất biến hoá.

### 11.3. Liên node

`RowLevelPolicyChannel` với `KIND = "rls"` trên `PostgresEventBus`, đúng khuôn `AuthorityChangeChannel`:

```java
@Order(1)   // sau cache, để node không bao giờ là người cuối biết về thay đổi của chính mình
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
public void broadcast(RowLevelPoliciesChanged change) { bus.publish(KIND, "changed"); }

@EventListener
public void onRemote(PostgresEventBus.RemoteEvent remote) {
    if (!KIND.equals(remote.kind())) return;
    events.publishEvent(new Received());
}
```

`Received` là **kiểu khác** với `RowLevelPoliciesChanged` — nếu cache không phân biệt được, nó sẽ phát lại thứ vừa nhận và hai node thông báo cho nhau vô tận.

### 11.4. `RowLevelPrincipal` — không đóng băng lúc đăng nhập

```java
public record RowLevelPrincipal(
        long userId, Long organizationId, Long departmentId,
        Set<String> roleCodes, Set<Long> roleIds) {}
```

Dựng từ cache theo tài khoản, **không** từ token, **không** chụp lúc login. Đóng băng lúc login sẽ khiến người vừa chuyển phòng vẫn thấy dữ liệu phòng cũ cho tới hết đời token — đúng thứ mà `AuthorityCache` đã được dựng lên để loại bỏ.

> **THAY ĐỔI BẮT BUỘC Ở `UserService`.** Hiện `AuthoritiesChanged.ForUser` được phát khi role hoặc status của tài khoản đổi. Phải phát **thêm** khi `organization` hoặc `department` đổi, vì cả hai giờ là đầu vào của phạm vi dữ liệu. Thiếu chỗ phát này thì việc chuyển phòng chỉ có hiệu lực sau tối đa 60 giây (TTL) thay vì ngay lập tức — suy biến chứ không sai, nhưng vẫn phải làm.

### 11.5. Con dấu phiên bản — không tạo vòng phụ thuộc

```java
// AuthorityCache.Entry.of(...)
String stamp = Integer.toHexString(
        (String.join(",", codes) + "|" + policyCache.generation()).hashCode());
```

`generation` là hash của toàn bộ tập chính sách đang bật, tính bởi `RowLevelPolicyCache` **từ dữ liệu của chính nó**. `AuthorityCache` chỉ đọc một chuỗi từ đó; chiều phụ thuộc có một hướng, không có vòng.

Nếu để con dấu gồm phạm vi *của riêng tài khoản* thì sẽ tạo vòng: con dấu cần role → role do `AuthorityCache` giữ → mà `AuthorityCache` đang dựng con dấu. Đó là đúng loại vòng đã buộc `token/` phải tách thành slice riêng.

**Đánh đổi:** sửa chính sách của `MANAGER` khiến **mọi** tài khoản đọc lại quyền ở request kế tiếp. Đó chính là đánh đổi codebase **đã chọn một lần rồi** cho `AuthoritiesChanged.ForEveryone`, với lý do đã ghi trong `CLAUDE.md`: *"Editing a role is a rare administrative act and the cost is one lookup per active account on its next request — cheaper than the coupling."* Sửa chính sách hiếm ngang sửa role.

**Không cần kênh mới ở phía client.** Con dấu đổi → header `X-Auth-Version` trên response kế tiếp lệch → hook `afterResponse` trong `data.ts` nạp lại → `authorities-sync.tsx` xoá cache `["access"]` và `["auth","permissions"]`. Tab đang mở nhận qua `/user/queue/auth` với **0 request**; tab có socket hỏng nhận qua header ở request kế tiếp.

### 11.6. Ngân sách hiệu năng

| Bước cho một request | Chi phí |
| :--- | :--- |
| Tra chính sách cho `(resource, action)` | bộ nhớ |
| Phân giải `RowLevelPrincipal` | bộ nhớ |
| Dựng `Specification` từ `ScopePlan` | CPU, không I/O |
| `WITH CHECK` khi ghi | bộ nhớ, trên entity đã nạp |
| Cờ `_can` mỗi dòng | bộ nhớ, trên entity đã nạp |
| **SQL phát sinh thêm cho phân quyền** | **0** |

Chi phí duy nhất lên truy vấn là các `EXISTS` mà phạm vi cần — trả bằng index trên khoá ngoại, thứ changeset `013` đã tạo.

---

## 12. KIỂM TRA HAI MỨC

Hai loại dữ liệu khác nhau, hai mức nghiêm trọng khác nhau. Gộp chúng làm một là sai ở cả hai hướng.

### 12.1. Metadata là **mã nguồn** → sai thì không khởi động

`RowLevelMetadataValidator` chạy ở `ApplicationReadyEvent`:

1. Mỗi `@RowLevelResource` có **đúng một** `RowLevelPolicySet`.
2. Mỗi `path` trong `fields()` phân giải được trên metamodel JPA của entity.
3. Mỗi `RowLevelContextProvider` có `key()` duy nhất.
4. `defaultScope()` đã hiện thực (bảo đảm bởi interface, nhưng kiểm lại giá trị `null`).
5. `resource()` không trùng nhau.

Sai bất kỳ điều nào ⇒ **ứng dụng không lên**, cùng tinh thần với `ddl-auto=validate`: một mapping lệch phải hỏng lúc khởi động chứ không phải lúc truy vấn đầu tiên.

### 12.2. Chính sách runtime là **dữ liệu** → chặn lúc ghi, cách ly lúc boot

**Lúc ghi** (`POST`/`PATCH` trên `/api/row_level_policies`) — kiểm đầy đủ, từ chối **`422`** kèm chỉ dẫn nút nào của cây sai:

- `resource` chưa khai báo `@RowLevelResource`
- `field` ngoài tập `fields()`
- `operator` không hợp với `type` của field
- số toán hạng sai (`isNull` mà có `value`, `between` mà có một giá trị)
- `value.lit` không ép được về `type`
- `value.ctx` không có provider đăng ký, hoặc `type` của provider không khớp
- `field` nằm trong `notCheckSafe()` khi `action = write`
- `kind = FILTER` mà có `role_id`, hoặc `kind = SCOPE` mà không có

Đây là **nơi duy nhất** chính sách hỏng bị chặn cứng — vì tại đây có người đang ngồi trước màn hình để sửa.

**Lúc boot**, nếu vẫn còn chính sách hỏng (schema đổi ở bản deploy mới, migration tay, khôi phục từ backup cũ):

- **Không** chặn khởi động — bắt cả node không lên vì một dòng dữ liệu là biến lỗi cấu hình thành sự cố ngừng dịch vụ, và nó xảy ra ở lần restart bất kỳ, có thể nhiều giờ sau khi chính sách được lưu, nên không ai liên hệ được hai việc với nhau.
- `enabled = false`, điền `invalid_reason`, ghi `QUARANTINE` vào audit, log `ERROR`.
- `RowLevelHealthIndicator` chuyển **`DOWN`** với danh sách chính sách bị cách ly.

**Hướng cách ly khác nhau theo `kind` — chi tiết dễ làm sai nhất của cả mục này:**

| | Chính sách hỏng bị vô hiệu thì… | Phải làm |
| :--- | :--- | :--- |
| `SCOPE` | phạm vi **hẹp lại** | cách ly là đủ — fail-closed |
| `FILTER` | hạn chế **biến mất** → lộ dữ liệu | cách ly **cộng thêm** chặn toàn bộ `(resource, action)` cho tới khi sửa |

Thà chặn hết còn hơn bỏ sót một lệnh cấm.

---

## 13. API QUẢN TRỊ

`row_level_policies` là một resource bình thường, tuân thủ đúng phương ngữ của data provider: `_start`/`_end`/`_sort`/`_order`, **mảng JSON trần**, `X-Total-Count`, `DELETE` trả body.

| Endpoint | Quyền | Ghi chú |
| :--- | :--- | :--- |
| `GET /api/row_level_policies` | `row_level_policies:read` | lọc `resource`, `action`, `role.id`, `kind`, `enabled` |
| `GET /api/row_level_policies/{id}` | `row_level_policies:read` | |
| `POST /api/row_level_policies` | `row_level_policies:write` | kiểm cây theo §12.2 |
| `PATCH|PUT /api/row_level_policies/{id}` | `row_level_policies:write` | |
| `DELETE /api/row_level_policies/{id}` | `row_level_policies:delete` | echo lại dòng đã xoá |
| `GET /api/row_level_policies/metadata` | `row_level_policies:read` | §13.1 |
| `GET /api/row_level_policies/explain` | + `users:read` | §13.2 |
| `POST /api/row_level_policies/simulate` | + `users:read` | §13.3 |
| `GET /api/row_level_policies/coverage` | `row_level_policies:read` | §13.4 |

`explain` và `simulate` nhận `userId` khác người gọi nên đòi **thêm** `users:read`: mô phỏng quyền của người khác là đọc thông tin về người khác.

### 13.1. `/metadata` — nuôi trình dựng câu điều kiện

```
GET /api/row_level_policies/metadata?resource=tasks
```

```json
{
  "resource": "tasks",
  "defaultScope": "FULL",
  "fields": [
    { "path": "status", "type": "enum", "nullable": false,
      "values": ["TODO","IN_PROGRESS","BLOCKED","DONE","CANCELLED"],
      "operators": ["eq","ne","in","notIn"] },
    { "path": "department.id", "type": "long", "nullable": true,
      "operators": ["eq","ne","in","notIn","isNull","isNotNull"] },
    { "path": "dueDate", "type": "date", "nullable": true,
      "operators": ["eq","ne","lt","lte","gt","gte","between","isNull","isNotNull"] }
  ],
  "context": [
    { "key": "user.id", "type": "long" },
    { "key": "user.departmentId", "type": "long" },
    { "key": "today", "type": "date" }
  ],
  "notCheckSafe": ["id","createdAt","updatedAt","completedAt"]
}
```

Đây là thứ khiến màn hình quản trị **không có ô nhập biểu thức tự do nào** — mọi lựa chọn là dropdown dựng từ metadata của server. Việc ô text đó không tồn tại chính là hình dạng phía UI của việc không có expression language.

### 13.2. `/explain`

```
GET /api/row_level_policies/explain?resource=tasks&action=read&userId=42
```

```json
{
  "principal": { "userId": 42, "departmentId": 7, "roleCodes": ["MANAGER","USER"] },
  "defaultScope": "FULL",
  "scopes": [
    { "source": "runtime#11", "role": "MANAGER", "reads": "department.id = 7" },
    { "source": "runtime#19", "role": "USER",    "reads": "assignee.id = 42" }
  ],
  "filters": [],
  "effective": "(department.id = 7 OR assignee.id = 42)",
  "sql": "... WHERE (EXISTS (SELECT 1 FROM departments d WHERE d.id = t.department_id AND d.id = ?) OR EXISTS (...))",
  "warnings": []
}
```

Khi một role không có `SCOPE` trên resource `FULL`, `warnings` nói thẳng:

```json
"warnings": ["role USER: không có SCOPE cho (tasks, read) → không bị thu hẹp (defaultScope = FULL)"]
```

### 13.3. `/simulate`

```
POST /api/row_level_policies/simulate
{ "resource": "tasks", "action": "write", "userId": 42, "recordId": 900 }
```

```json
{
  "allowed": false,
  "evaluatedAs": "UNKNOWN",
  "failedAt": "createdBy.id = user.id",
  "because": "createdBy is null"
}
```

Trả về **giá trị ba trị**, không phải boolean. `UNKNOWN` là câu trả lời hay gặp nhất cho *"vì sao tôi không thấy bản ghi này"* và khó đoán nhất — thường là một khoá ngoại `null` (ví dụ `created_by_id` đã bị `SET NULL` khi người tạo nghỉ việc) làm cả nhánh thành `UNKNOWN` và dòng bị loại theo quy tắc §3.4.

Đây là công cụ vận hành quan trọng nhất của cả hệ thống. Không có nó thì mỗi câu hỏi như trên là một buổi chiều đọc log.

### 13.4. `/coverage` — ma trận phủ

```json
{
  "resources": [
    { "resource": "tasks", "defaultScope": "FULL",
      "cells": [
        { "role": "ADMIN",   "action": "read",  "hasScope": false, "risk": "UNRESTRICTED" },
        { "role": "MANAGER", "action": "read",  "hasScope": true,  "risk": "OK" },
        { "role": "USER",    "action": "read",  "hasScope": false, "risk": "UNRESTRICTED" }
      ] }
  ]
}
```

Màn hình hiển thị dạng lưới role × action, tô đỏ mọi ô `UNRESTRICTED`. Đây là thứ biến khoảng trống chính sách từ **một mặc định đoán bừa** thành **một ô đỏ có người nhìn thấy**.

### 13.5. Khai báo phía frontend

`routes.tsx` thêm resource, **cả hai nửa** — mảng `resources` và cây `<Route>`, vì lệch nhau thì nút và breadcrumb im lặng dẫn đi đâu không rõ:

```tsx
{
  name: "row_level_policies",
  list: "/administration/row-level-policies",
  create: "/administration/row-level-policies/create",
  edit: "/administration/row-level-policies/edit/:id",
  show: "/administration/row-level-policies/show/:id",
  meta: { parent: "administration", label: "Data scopes", icon: <ShieldIcon /> },
}
```

Đặt dưới nhóm `administration` đã có. Vì chỉ ADMIN có `row_level_policies:read`, `useAccessibleMenuItems` trong `sidebar.tsx` sẽ tự ẩn mục này với mọi tài khoản khác — và ẩn cả nhóm nếu không còn mục nào sống sót.

Các trang dùng **plain page pattern** (`CreateView`/`EditView`/`ShowView` full-page), không phải dialog: trình dựng câu điều kiện cần nhiều chiều dọc, cùng lý do mà `roles` và `users` chọn pattern này.

> **Nhắc:** mỗi trang phải tự render `ListViewHeader` / `CreateViewHeader` / `EditViewHeader` / `ShowViewHeader` của nó. Quên thì không có lỗi biên dịch, không có cảnh báo lint, không có phàn nàn lúc chạy — chỉ có một màn hình không breadcrumb và không lối ra.

---

## 14. FRONTEND

### 14.1. Cờ `_can` trên mỗi dòng

```json
{ "id": 900, "title": "Chuẩn bị báo cáo quý", "_can": { "write": true, "delete": false } }
```

Tính bằng `EntityEvaluator` là **`USING ∧ WITH CHECK` trên trạng thái hiện tại** — tức là *"bạn được mở form sửa dòng này, miễn là không đẩy nó ra khỏi phạm vi"*. Đó là câu trả lời chính xác cho câu hỏi mà một cái nút cần. Việc một thay đổi *cụ thể* bị từ chối vẫn là `422` từ server, và đó là đúng chỗ để trả lời.

Chỉ tính `USING` thôi thì cờ nói `true` mà mọi lần sửa đều `422` — cờ nói một điều, hệ thống làm một điều khác.

Tiền tố `_` tách khỏi không gian tên dữ liệu nghiệp vụ. **Chỉ phát khi có fetch hint** (§9).

### 14.2. `providers/access-control.ts`

Giữ nguyên toàn bộ logic hiện có, thêm một nhánh. Khi Refine truyền bản ghi qua `params.resource` — các `*Button` đều truyền — tra `_can`:

```ts
async can({ resource, action, params }) {
  const permissions = getAuthorities()?.permissions;
  if (!permissions) return { can: false };
  if (!resource) return { can: true };

  const required = permissionFor(resource, action);
  if (required && !permissions.includes(required)) {
    return { can: false, reason: `You need the ${required} permission` };
  }

  // Phạm vi dòng: chỉ hỏi khi có bản ghi cụ thể trong tay. Không hỏi cho
  // "read" — dòng nào không đọc được thì đã không có mặt trong response.
  const record = params?.resource as { _can?: Record<string, boolean> } | undefined;
  const rowScope = ACTION_TO_PERMISSION[action];
  if (record?._can && rowScope && rowScope !== "read") {
    return record._can[rowScope]
      ? { can: true }
      : { can: false, reason: "This record is outside your data scope" };
  }

  return { can: true };
}
```

`options.buttons.hideIfUnauthorized` đã bật, nên `<EditButton>` và `<DeleteButton>` **tự ẩn trên đúng những dòng không thao tác được** — giữ quy ước "ẩn chứ không disable" của dự án, thay vì mời người dùng bấm vào một nút chắc chắn `403`.

### 14.3. `scopedResources` — danh sách rỗng phải nói được vì sao

Một người có `tasks:read` nhưng phạm vi hẹp nhìn thấy y hệt một hệ thống chưa có dữ liệu. Đó là một ticket hỗ trợ đang chờ được tạo.

`GET /api/auth/permissions` thêm một trường, tính từ cache nên **không tốn truy vấn**:

```json
{ "roles": [...], "permissions": [...], "version": "...", "scopedResources": ["tasks"] }
```

`AuthoritiesResponse` và `session.ts` (`applyAuthorities`) mang thêm trường này. Màn hình danh sách của một resource nằm trong `scopedResources` đổi câu trạng thái rỗng thành:

> *"Không có bản ghi nào trong phạm vi dữ liệu của bạn."*

Một trường, một câu chữ, và người dùng biết phải hỏi ai.

Cùng cơ chế đó xử lý ô trống của `getMany` (§7.3): khi một tóm tắt khoá ngoại không phân giải được, hiển thị `—` thay vì để trống lửng.

### 14.4. Không cần đụng tới `WebMvcConfig`

`X-Total-Count` và `X-Auth-Version` đã nằm trong `Access-Control-Expose-Headers`. Thiết kế này không thêm header nào — đó là chủ đích: con dấu phạm vi đi **bên trong** `X-Auth-Version` đã có (§11.5), nên không có header mới nào để quên đưa vào danh sách và không có lỗi im lặng mới nào.

---

## 15. MÔ HÌNH ĐE DOẠ

| Đe doạ | Chặn bằng | Mục |
| :--- | :--- | :--- |
| Thực thi mã qua chính sách runtime | Không có expression language; cây dữ liệu + từ vựng đóng | §3.1 |
| Thêm role làm mất quyền | `OR` giữa các `SCOPE` | §2.2 |
| Né lệnh cấm bằng cách không có role | `FILTER` không gắn role, `AND` luôn | §2.1 |
| Nới phạm vi bằng query string | Phạm vi `.and(...)` trước bộ lọc; `Specification.and` không có phép trừ | §7.3 |
| Đường đọc quên scope | Phương thức không tồn tại để gọi | §7.1 |
| Đường xoá không được bảo vệ | `delete` đọc qua `Action.DELETE` | §8.3 |
| Dòng biến mất vì INNER JOIN | `EXISTS`, không sinh JOIN | §6.2 |
| Hai trình biên dịch bất đồng về `NULL` | Ba trị đặc tả + NNF + test đối chiếu | §3.4, §6.1, §16 |
| Đẩy dòng ra khỏi phạm vi để giấu | `WITH CHECK` tách khỏi `USING` | §8.1 |
| Tạo bản ghi ngoài phạm vi | `WITH CHECK` sau `flush()` | §8.2 |
| Dò sự tồn tại của id | `404` cho mọi dòng ngoài phạm vi đọc | §7.3 |
| Dữ liệu lồng lọt qua | `EntityEvaluator` che tóm tắt nhúng | §9 |
| Ngữ cảnh cũ sau khi chuyển phòng | Cache bất biến hoá bằng sự kiện | §11.4 |
| Quên viết chính sách cho resource mới | `defaultScope = NONE` + ma trận phủ | §2.3, §13.4 |
| Chính sách sai làm sập node | Chặn `422` lúc ghi; boot thì cách ly + health `DOWN` | §12.2 |
| `FILTER` hỏng làm lộ dữ liệu | Cách ly `FILTER` ⇒ chặn toàn bộ `(resource, action)` | §12.2 |
| Bỏ qua phân quyền không dấu vết | `asSystem` log `INFO` + counter | §7.4 |
| Đổi chính sách để tự cấp quyền | `row_level_policies:write` chỉ ADMIN; mọi thay đổi vào audit | §10.2, §10.1 |

### 15.1. Vì sao chưa dùng RLS gốc của PostgreSQL

PostgreSQL có `CREATE POLICY`. Đã cân nhắc và chưa dùng, vì ba lý do cụ thể:

- Cần `SET LOCAL app.user_id` cho **mọi** transaction trên connection pool; sót một chỗ là một chính sách không áp dụng — lại một lỗi im lặng nữa.
- Chính sách viết bằng SQL, tách khỏi cây JSON ⇒ hai bản luật để lệch nhau, đúng thứ §6 tồn tại để ngăn.
- Second-level cache và batch fetch của Hibernate không biết về RLS ở tầng dưới.

**Đường ghép đã để sẵn:** tập `RowLevelContextProvider` chính là tập biến sẽ được đẩy xuống session GUC nếu sau này muốn thêm RLS gốc làm phòng thủ chiều sâu. Không phải viết lại gì.

---

## 16. KIỂM THỬ

| # | Kiểm gì | Cần DB? |
| :--- | :--- | :--- |
| T1 | **Đại số**: `OR` giữa `SCOPE`, `AND` với `FILTER`, kể cả tập rỗng và `defaultScope` cả hai giá trị | Không |
| T2 | **Bảng chân trị ba trị**: đủ tổ hợp `all`/`any`/`not` × `TRUE`/`FALSE`/`UNKNOWN` | Không |
| T3 | **NNF**: `not` không còn xuất hiện ở nút trong sau khi `PolicyCompiler` chạy | Không |
| T4 | **Đối chiếu hai trình biên dịch** — cùng cây, cùng dữ liệu, tập id từ `PredicateCompiler` **bằng** tập id từ `EntityEvaluator`. Fixture **bắt buộc** phủ mọi tổ hợp `not` × trường nullable × ctx `null` | **Có** |
| T5 | **Đơn điệu** — sinh ngẫu nhiên tập role; thêm role **không bao giờ** làm giảm số dòng thấy được | Có |
| T6 | Không né được `FILTER`: bỏ hết role của user, `FILTER` vẫn áp | Có |
| T7 | SQL sinh ra **không chứa `join`**; `Page.getTotalElements()` trùng số dòng thực | Có |
| T8 | `WITH CHECK` create: chính sách chạm `createdAt` bị từ chối **lúc lưu chính sách**, không phải lúc tạo bản ghi | Không |
| T9 | `WITH CHECK` update: đổi `department` sang phòng khác ⇒ `422`, dòng không đổi | Có |
| T10 | `get`/`getMany` ngoài phạm vi ⇒ `404` / vắng mặt, **không** `403` | Có |
| T11 | **`repository.findById(1L)` trên `TaskRepository` phải KHÔNG biên dịch được** | Không (test biên dịch) |
| T12 | Tóm tắt nhúng bị che khi resource của nó ngoài phạm vi đọc | Có |
| T13 | `_can` không phát khi thiếu fetch hint (fail-fast, không N+1) | Có |
| T14 | Cách ly: `SCOPE` hỏng ⇒ chỉ vô hiệu; `FILTER` hỏng ⇒ chặn toàn bộ `(resource, action)` | Có |
| T15 | Boot với một chính sách hỏng ⇒ khởi động **thành công**, health `DOWN`, `enabled = false`, có dòng `QUARANTINE` | Có |
| T16 | Sửa chính sách trên node A ⇒ node B đổi hành vi | Có, 2 context |
| T17 | Đổi `department` của user ⇒ phạm vi đổi ở request kế tiếp (kiểm thay đổi ở §11.4) | Có |
| T18 | Design-time policy: `Specification` và `Tri` predicate viết tay cho cùng kết quả (T4 áp cho từng policy viết tay) | Có |

**T4, T5, T11 là ba test không được bỏ.** Chúng lần lượt canh ba lỗi mà thiết kế này tồn tại để tránh: hai trình biên dịch bất đồng, thêm role làm mất quyền, và một đường đọc quên scope. Viết chúng **trước** khi đưa `tasks` vào diện quản lý.

---

## 17. LỘ TRÌNH THI CÔNG

| GĐ | Nội dung | Xong khi |
| :--- | :--- | :--- |
| **1. Lõi** | `shared/security/rowlevel/*` (ScopeTree, Tri, Op, FieldDescriptor, RowLevelPolicySet, ContextProvider, DefaultScope, Action). `PolicyCompiler` (NNF + ép kiểu), `PredicateCompiler`, `EntityEvaluator`. **T1–T5** | Test lõi xanh; T4 chạy được với fixture DB tối thiểu |
| **2. Design-time trước** | `TaskRowLevelPolicies` với `defaultScope = FULL`, `RowLevelSecurity` + impl đọc từ policy set (chưa có bảng), `RowLevelMetadataValidator` | `tasks` chịu quản lý mà **chưa cần bảng runtime nào** |
| **3. `SecuredRepository`** | `shared/data/SecuredRepository` + base impl; đổi `TaskRepository`; viết lại `TaskService.list/get/getMany/create/update/delete`; `RowLevelViolationException` + handler `422`. **T7–T11** | `findById` không còn biên dịch được trên `TaskRepository` |
| **4. Runtime** | `015`, `016`, entity, `RowLevelPolicyService` + audit, `RowLevelPolicyCache`, `RowLevelPolicyChannel`, validator mức 2, health indicator. **T14–T16** | Sửa chính sách có hiệu lực trên node khác < 1 giây; chính sách hỏng không làm sập boot |
| **5. Ngữ cảnh** | `RowLevelPrincipalResolver`; **phát `AuthoritiesChanged.ForUser` khi đổi organization/department trong `UserService`**; con dấu `generation` vào `AuthorityCache`. **T17** | Chuyển phòng có hiệu lực ở request kế tiếp |
| **6. Bề mặt** | `_can` + fetch hints, che tóm tắt nhúng, `scopedResources` vào `AuthoritiesResponse` và `session.ts`, nhánh mới trong `access-control.ts`. **T12, T13** | Ba tài khoản seed thấy đúng ba phạm vi; nút ẩn đúng dòng |
| **7. Quản trị** | Controller + DTO + `/metadata` + `/explain` + `/simulate` + `/coverage`; trang Refine với query builder; `routes.tsx` cả hai nửa | Đổi phạm vi mà không phải deploy |
| **8. Mở rộng** | `organizations`, `departments`, `blog_posts` | Mỗi resource = một `RowLevelPolicySet` |

**Điểm đáng chú ý: giai đoạn 2 chạy được trước khi có bảng runtime.** Tầng design-time là mã nguồn thuần, nên có thể đưa `tasks` vào diện quản lý, viết chính sách bằng Java, review và test — rồi mới thêm tầng runtime khi thật sự cần sửa chính sách mà không deploy. Không phải dựng cả hạ tầng DB trước khi lọc được dòng đầu tiên.

**Ngày triển khai không ai mất quyền gì**, vì `defaultScope = FULL` và `016` không seed dòng chính sách nào.

---

## 18. PHỤ LỤC: KỊCH BẢN ĐẦY ĐỦ CHO `tasks`

Dùng đúng dữ liệu seed hiện có: ba role `ADMIN` / `MANAGER` / `USER`, ba tài khoản `admin` / `manager` / `viewer`, tổ chức `DTH` / `DTHS` / `DTHC`, phòng ban `ENG` / `EXEC` / `HR` / `FIN` / `DESIGN` / `SALES`.

### 18.1. Yêu cầu nghiệp vụ

| Vai | Đọc | Sửa |
| :--- | :--- | :--- |
| ADMIN | tất cả | tất cả |
| MANAGER | mọi việc của phòng mình | việc mình tạo **hoặc** được giao cho mình |
| USER | việc được giao cho mình **hoặc** mình tạo | như trên |
| Mọi vai | — | không ai được đẩy một task sang phòng khác nếu phòng đích không nằm trong phạm vi của mình |

### 18.2. Chính sách

`defaultScope = FULL`, nên **ADMIN không cần chính sách nào** — không có `SCOPE` thì không bị thu hẹp. Đó là điều làm cho bảng dưới đây ngắn.

```jsonc
// #1  SCOPE (MANAGER, tasks, read)   name: "Việc của phòng tôi"
{ "field": "department.id", "op": "eq", "value": { "ctx": "user.departmentId" } }

// #2  SCOPE (MANAGER, tasks, write)  name: "Việc tôi tạo hoặc được giao"
{ "any": [
    { "field": "createdBy.id", "op": "eq", "value": { "ctx": "user.id" } },
    { "field": "assignee.id",  "op": "eq", "value": { "ctx": "user.id" } }
]}

// #3  SCOPE (USER, tasks, read)      name: "Việc của tôi"
{ "any": [
    { "field": "assignee.id",  "op": "eq", "value": { "ctx": "user.id" } },
    { "field": "createdBy.id", "op": "eq", "value": { "ctx": "user.id" } }
]}

// #4  SCOPE (USER, tasks, write)     name: "Việc của tôi"   (cùng cây với #3)

// #5  SCOPE (MANAGER, tasks, delete) name: "Việc của phòng tôi"  (cùng cây với #1)
```

`USER` **không** có `SCOPE` cho `delete`, và `USER` cũng không có `tasks:delete` trong `role_permissions` — hai tầng đồng ý với nhau, và tầng thứ nhất chặn trước.

### 18.3. Kết quả với `manager` (role `MANAGER` + `USER`, phòng `ENG` của `DTHS`)

Đọc: `#1 OR #3` =

```
department.id = ENG  OR  assignee.id = manager  OR  createdBy.id = manager
```

Thấy: *Draft the Q3 engineering roadmap* (ENG, giao cho manager), *Migrate the staging database* (ENG), *Refresh the design system tokens* (DESIGN của DTHS — **không** thuộc ENG, và không giao cho manager) ⇒ **không thấy**.

**Đây là điểm mấu chốt của cả thiết kế.** Nếu `SCOPE` ghép bằng `AND` như một số framework khác làm, `manager` sẽ chỉ thấy `department = ENG AND assignee = manager` — tức là mất *Migrate the staging database*, một việc của chính phòng mình. Thêm role `USER` sẽ **lấy đi** quyền. `OR` là thứ ngăn điều đó.

### 18.4. Kết quả với `viewer` (role `USER`, phòng `SALES` của `DTHC`)

Đọc: `#3` = `assignee.id = viewer OR createdBy.id = viewer` ⇒ chỉ *Prepare the client renewal pack*.

Bảy task còn lại **không tồn tại** với `viewer`: không có trong danh sách, và `GET /api/tasks/1` trả `404`.

### 18.5. Kịch bản `WITH CHECK`

`manager` sửa *Draft the Q3 engineering roadmap* (ENG, do mình được giao):

| Thao tác | USING (#2 trên trạng thái cũ) | WITH CHECK (#2 trên trạng thái mới) | Kết quả |
| :--- | :--- | :--- | :--- |
| Đổi `status` → `DONE` | ✔ assignee = manager | ✔ assignee vẫn = manager | `200` |
| Đổi `assignee` → `viewer` | ✔ | ✘ assignee ≠ manager, createdBy = admin | **`422`** |
| Đổi `department` → `SALES` | ✔ | ✔ (#2 không xét department) | `200`, nhưng dòng **biến mất khỏi tầm nhìn đọc** của manager vì #1 không còn khớp |

Dòng thứ ba là hành vi đúng và cần hiểu rõ: `WITH CHECK` dùng phạm vi **`write`**, và `#2` không nói gì về `department`. Muốn chặn việc chuyển phòng thì thêm điều kiện vào `#2`:

```jsonc
// #2 (bản siết) — vẫn phải nằm trong phòng mình sau khi sửa
{ "all": [
    { "any": [
        { "field": "createdBy.id", "op": "eq", "value": { "ctx": "user.id" } },
        { "field": "assignee.id",  "op": "eq", "value": { "ctx": "user.id" } }
    ]},
    { "field": "department.id", "op": "eq", "value": { "ctx": "user.departmentId" } }
]}
```

Sau đó thao tác thứ ba trả `422` với thông điệp *"trường department đưa bản ghi ra ngoài phạm vi dữ liệu của bạn"*.

### 18.6. Chuyển sang `defaultScope = NONE`

Khi cả ba role đã có `SCOPE` cho cả ba action (theo dõi bằng `/coverage` — không còn ô đỏ), đổi một dòng trong `TaskRowLevelPolicies`:

```java
@Override public DefaultScope defaultScope() { return DefaultScope.NONE; }
```

Từ đó, một role mới tạo mà chưa ai viết `SCOPE` sẽ **không thấy dòng nào** thay vì thấy tất cả. Đây là trạng thái đích cho mọi resource; `FULL` chỉ là công cụ để đưa một resource đang chạy vào diện quản lý mà không làm gián đoạn ai.

**Lưu ý:** với `NONE`, ADMIN cần một `SCOPE` toàn phạm vi tường minh:

```jsonc
// SCOPE (ADMIN, tasks, read|write|delete)  name: "Toàn phạm vi"
{ "all": [] }
```

Đó là ba dòng dữ liệu, đổi lấy việc mọi khoảng trống chính sách trong tương lai đều fail-closed. Một đánh đổi đáng.
