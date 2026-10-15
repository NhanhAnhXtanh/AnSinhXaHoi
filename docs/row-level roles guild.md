# HƯỚNG DẪN THI CÔNG: PHÂN QUYỀN DÒNG DỮ LIỆU (ROW-LEVEL ROLES)

Tài liệu dành cho **người viết code**, không phải người thiết kế. Nó trả lời ba câu:

1. Làm sao đưa một resource vào diện quản lý dòng?
2. Viết một policy như thế nào cho đúng ý mình?
3. Khi nó không chạy như mình nghĩ thì tra ở đâu?

Thiết kế và lý do đằng sau nằm ở `row_level_role_final.md`. Tài liệu này chỉ nói *làm thế nào*, cộng một mục dài về **những chỗ dễ sai** — mục đó mới là phần đáng đọc kỹ nhất.

---

## MỤC LỤC

- [0. Trước khi bắt đầu](#0-trước-khi-bắt-đầu)
- [1. Từ vựng tối thiểu](#1-từ-vựng-tối-thiểu)
- [2. Đưa một resource vào diện quản lý](#2-đưa-một-resource-vào-diện-quản-lý)
- [3. Viết policy trên màn hình quản trị](#3-viết-policy-trên-màn-hình-quản-trị)
- [4. Chín cái bẫy](#4-chín-cái-bẫy)
- [5. Chẩn đoán khi nó không như mong đợi](#5-chẩn-đoán-khi-nó-không-như-mong-đợi)
- [6. Checklist review](#6-checklist-review)
- [7. Phụ lục](#7-phụ-lục)

---

## 0. TRƯỚC KHI BẮT ĐẦU

### Row-level trả lời câu nào, và không trả lời câu nào

Hệ thống có **hai lớp phân quyền, nối tiếp nhau**:

| Lớp | Câu hỏi | Quyết định ở | Từ chối bằng |
| :--- | :--- | :--- | :--- |
| Resource permission | Được gọi `GET /api/tasks` không? | `@PreAuthorize` trên controller | `403` |
| **Row-level** | Trong `tasks`, thấy **dòng nào**? | `Specification` ghép vào truy vấn | dòng vắng mặt → `404` |

Không có `tasks:read` thì **không bao giờ** chạm tới lớp thứ hai. Có `tasks:read` mà phạm vi rỗng thì thấy danh sách trống — **đó là câu trả lời đúng, không phải lỗi**.

### Đừng dùng row-level cho những việc này

Row-level trả lời **"dòng nào"**. Nó không trả lời:

- **"Được chuyển trạng thái nào"** — đó là luật quy trình. Xem bẫy #2; có cách làm được, nhưng phải hiểu mình đang làm gì.
- **"Được sửa trường nào"** — row-level chặn cả dòng, không chặn từng cột. Cần cái đó thì viết trong service.
- **"Ai được duyệt"** — đó là một mã quyền riêng (`blog_posts:publish`), không phải một phạm vi dòng.

Nhét luật quy trình vào row-level là nguyên nhân phổ biến nhất của những bug khó hiểu ở mục 4.

---

## 1. TỪ VỰNG TỐI THIỂU

### `SCOPE` và `FILTER`

|  | `SCOPE` | `FILTER` |
| :--- | :--- | :--- |
| Gắn vào | **một role** | **resource** — áp cho mọi người |
| Ý nghĩa | role này với tới được dòng nào | không ai được chạm dòng nào |
| Ghép với nhau bằng | **`OR`** giữa các role của user | **`AND`**, luôn luôn |
| Vắng mặt nghĩa là | role đó không bị thu hẹp | không có hạn chế toàn cục |

```
THẤY ĐƯỢC = ( OR các SCOPE của những role user đang giữ )
           AND ( AND mọi FILTER trên resource )
```

`SCOPE` dùng `OR` vì role trong hệ thống này **cộng dồn**. Thêm một role phải chỉ có thể **nới rộng**. Nếu ghép bằng `AND` thì cấp thêm role sẽ *lấy đi* quyền — điều không ai đoán được.

`FILTER` không gắn role vì một lệnh cấm gắn với role thì né được bằng cách... không giữ role đó.

> **Không có `priority`, không có thứ tự.** `FILTER` luôn thắng vì nó là phép giao, không phải vì nó xếp trước.

### `action`

Ba giá trị: `read`, `write`, `delete` — đúng ba thứ mà sáu action của Refine đã thu gọn về.

### `defaultScope`

Khai trong code, **bắt buộc**, không có mặc định ngầm:

| | Role **không có** SCOPE thì… | Dùng khi |
| :--- | :--- | :--- |
| `FULL` | không bị thu hẹp — thấy tất cả | Đưa một resource **đang chạy** vào diện quản lý. Bật lên là no-op |
| `NONE` | không thấy dòng nào | **Đích đến** của mọi resource. Quên viết policy thì màn hình trống ngay |

Hiện tại **cả 5 resource đều là `FULL`**. Đó là trạng thái quá độ, không phải trạng thái mong muốn. Xem bẫy #4.

### `USING` và `WITH CHECK`

| action | `USING` — trạng thái **cũ** | `WITH CHECK` — trạng thái **mới** |
| :--- | :--- | :--- |
| `read` | ✔ ghép vào `WHERE` | — |
| `write` / create | — (chưa có dòng) | ✔ sau `flush()` |
| `write` / update | ✔ | ✔ |
| `delete` | ✔ | — |

`WITH CHECK` chặn việc **đẩy một dòng ra khỏi phạm vi của chính mình** — sửa `department` của task sang phòng khác để giấu nó. Không có nó, `USING` một mình là lỗ hổng leo thang quyền bằng cách rửa dữ liệu.

Hai mệnh đề là **hai điều kiện độc lập**, `WITH CHECK` mặc định lấy theo `USING` (giống Postgres). Khi nào cần tách: bẫy #2.

---

## 2. ĐƯA MỘT RESOURCE VÀO DIỆN QUẢN LÝ

Năm bước. Làm đủ cả năm, đặc biệt bước 5.

Ví dụ dưới đây dùng một resource giả định `invoices`. Mẫu thật để đối chiếu: `module/bpm/task/` (đầy đủ nhất) hoặc `module/catalog/department/` (có reference).

### Bước 1 — Đánh dấu entity

```java
// domain/finance/invoice/Invoice.java

@RowLevelResource("invoices")   // TRÙNG TÊN với routes.tsx và mã quyền
@Entity
@Table(name = "invoices")
public class Invoice { ... }
```

Tên resource là **nguyên văn** chuỗi trong `frontend/src/routes.tsx`, nửa đầu của mã quyền trong `shared/security/Permissions`, và path segment của controller. `blog_posts` — có dấu gạch dưới. Không có bảng tra cứu ở giữa để lệch pha; sai chính tả là lỗi khởi động, không phải một policy im lặng áp vào hư không.

### Bước 2 — Khai policy set

```java
// module/finance/invoice/security/InvoiceRowLevelPolicies.java

@Component
public class InvoiceRowLevelPolicies implements RowLevelPolicySet<Invoice> {

    @Override public String resource()          { return "invoices"; }
    @Override public Class<Invoice> entityClass() { return Invoice.class; }

    /** FULL vì resource đang chạy: bật lên không đổi hành vi của ai. */
    @Override public DefaultScope defaultScope() { return DefaultScope.FULL; }

    @Override public List<FieldDescriptor> fields() {
        return List.of(
            FieldDescriptor.id("id"),
            FieldDescriptor.column("status",    InvoiceStatus.class, false), // false = NOT NULL
            FieldDescriptor.column("issuedAt",  Instant.class,       false),
            FieldDescriptor.column("dueDate",   LocalDate.class),            // mặc định nullable
            FieldDescriptor.reference("customer",   Customer.class),
            FieldDescriptor.reference("department", Department.class));
    }

    @Override public Set<String> notCheckSafe() {
        return Set.of("id", "issuedAt", "createdAt", "updatedAt");
    }
}
```

**Về `fields()`:** đây là tập **đóng**. Policy không trỏ được vào trường nào ngoài danh sách này. Chỉ khai những trường thực sự là **ranh giới bảo mật** — đừng khai `title`, `description`, `note`. Một scope viết trên trường text tự do sẽ hỏng ngay lần đầu ai đó sửa lỗi chính tả.

**Về `reference(...)`:** policy viết là `customer.id`, và trình biên dịch sinh ra `EXISTS` tương quan — không sinh JOIN. Luôn để nullable kể cả khi cột đang `NOT NULL`; policy giả định ngược lại sẽ ngừng khớp vào ngày cột được nới lỏng.

**Về `notCheckSafe()`:** những trường chỉ có giá trị **sau khi flush**. Xem bẫy #5.

### Bước 3 — Đổi repository

```java
// TRƯỚC
public interface InvoiceRepository
        extends JpaRepository<Invoice, Long>, JpaSpecificationExecutor<Invoice> {}

// SAU
public interface InvoiceRepository extends SecuredRepository<Invoice, Long> {}
```

Đây là bước có sức nặng nhất. `SecuredRepository` **không** kế thừa `JpaRepository`, nên `findById`, `findAll()`, `findAllById`, `count()`, `existsById` **không tồn tại để mà gọi nhầm**. Code cũ sẽ không biên dịch được — đó là mục đích: nó ép bạn đi qua bước 4.

Muốn một đường đọc không giới hạn thì **khai thêm một phương thức** trên interface con, kèm comment giải thích. Ví dụ thật, từ `OrganizationRepository`:

```java
/**
 * Kiểm tra trùng code. CỐ Ý không scope: một câu hỏi "code này đã dùng chưa"
 * mà không thấy được dòng nó đang so sánh thì không phải kiểm tra trùng.
 */
Optional<Organization> findByCodeIgnoreCase(String code);
```

Một phương thức mới trên repository chịu quản lý dòng là thứ **nhìn thấy được khi review**, khác hẳn việc gọi một phương thức kế thừa sẵn.

### Bước 4 — Viết lại service

Tiêm facade:

```java
private final RowLevelSecurity rowLevel;
```

**Đọc** — phạm vi luôn `.and(...)` **trước** bộ lọc của người dùng:

```java
public Page<Invoice> list(ListParams params) {
    return repository.findAll(
            rowLevel.scope(Invoice.class, Action.READ)      // phạm vi TRƯỚC
                    .and(InvoiceSpecifications.from(params)), // bộ lọc SAU
            params.pageable(SORTABLE, DEFAULT_SORT));
}

public Invoice get(Long id) {
    return repository.findOne(rowLevel.byId(Invoice.class, Action.READ, id))
            .orElseThrow(() -> new ResourceNotFoundException("Invoice", id));
}

public List<Invoice> getMany(List<Long> ids) {
    return repository.findAll(rowLevel.byIds(Invoice.class, Action.READ, ids));
}
```

`Specification.and` **không có phép trừ**, nên không query string nào nới rộng được phạm vi. Thứ tự này không phải để cho đẹp.

**Tạo mới** — `checkWritable` **sau** `flush()`:

```java
@Transactional
public Invoice create(InvoiceRequest request) {
    Invoice invoice = /* dựng như cũ */;

    Invoice saved = repository.persist(invoice);
    repository.flush();            // id và @PrePersist đã có
    rowLevel.checkWritable(saved); // trượt → ném → rollback cả transaction

    return saved;
}
```

**Sửa** — `USING` khi đọc, `WITH CHECK` trước khi lưu:

```java
@Transactional
public Invoice update(Long id, InvoicePatchRequest request) {
    // USING trên trạng thái cũ. Ngoài phạm vi → 404.
    Invoice invoice = repository.findOne(rowLevel.byId(Invoice.class, Action.WRITE, id))
            .orElseThrow(() -> new ResourceNotFoundException("Invoice", id));

    /* ... áp patch, không đổi ... */

    // WITH CHECK trên trạng thái mới. Trong bộ nhớ, 0 câu SQL.
    rowLevel.checkWritable(invoice);
    return repository.persist(invoice);
}
```

> Entity đem ghi **phải chính là** entity đã đọc qua phạm vi. Đọc một bản để kiểm rồi `save` một bản detached khác lên cùng khoá sẽ cho `NonUniqueObjectException`, hoặc tệ hơn là ghi đè im lặng.

**Xoá** — dùng `Action.DELETE`, không tái sử dụng phạm vi đọc:

```java
@Transactional
public Invoice delete(Long id) {
    Invoice invoice = repository.findOne(rowLevel.byId(Invoice.class, Action.DELETE, id))
            .orElseThrow(() -> new ResourceNotFoundException("Invoice", id));
    repository.remove(invoice);
    return invoice;   // controller echo lại: data provider parse body của DELETE
}
```

Có người được **thấy** một dòng mà không được **xoá** nó. Dùng lại phạm vi đọc ở đây là âm thầm cấp quyền thứ hai kèm quyền thứ nhất.

### Bước 5 — Controller và response

Đây là bước **hay bị quên nhất**, và quên thì không có lỗi nào cả — chỉ là mọi nút bấm hiện ra trên mọi dòng.

```java
// Controller: tiêm thêm rowLevel, chỉ để đóng dấu _can lên từng dòng
public InvoiceController(InvoiceService service, RowLevelSecurity rowLevel) { ... }

// và truyền xuống ở list / getMany / get / create / update
InvoiceResponse.from(invoice, rowLevel)
```

```java
// Response: thêm trường _can
public record InvoiceResponse(
        Long id,
        /* ... */,
        @JsonProperty("_can") Map<String, Boolean> can) {

    /** Không có cờ — dùng cho echo của dòng vừa xoá, không ai thao tác được nữa. */
    public static InvoiceResponse from(Invoice invoice) {
        return from(invoice, null);
    }

    public static InvoiceResponse from(Invoice invoice, RowLevelSecurity rowLevel) {
        return new InvoiceResponse(
                invoice.getId(),
                /* ... */,
                rowLevel == null ? Map.of() : rowLevel.capabilities(invoice));
    }
}
```

`_can` được tính là **`USING` ∧ `WITH CHECK` trên trạng thái hiện tại** — đúng câu trả lời mà một cái nút cần: *"bạn được mở form sửa dòng này, miễn là không đẩy nó ra khỏi phạm vi"*. `providers/access-control.ts` đọc nó và tự ẩn nút Edit / Delete trên đúng những dòng sẽ bị từ chối.

### Không cần làm gì thêm

- **Không migration.** `defaultScope = FULL` lo việc "bật lên là no-op"; không có dòng policy nào phải seed.
- **Không sửa `WebMvcConfig`.** Thiết kế này không thêm header nào.
- **Không sửa frontend** cho resource của bạn — resource mới tự xuất hiện trong dropdown của màn hình Data scopes (nó đọc từ `/coverage`).

---

## 3. VIẾT POLICY TRÊN MÀN HÌNH QUẢN TRỊ

`Administration → Data scopes`. Chỉ `ADMIN` thấy được mục này.

### Ngữ pháp

Policy là **dữ liệu**, không phải ngôn ngữ. Bốn dạng nút, hai dạng giá trị:

```
Node  := { "all": [Node...] }        // AND
       | { "any": [Node...] }        // OR
       | { "not": Node }
       | { "field": <path>, "op": <op>, "value": Value? }

Value := { "lit": <hằng JSON> } | { "ctx": <khoá ngữ cảnh> }
```

`{"all": []}` là cây rỗng — **luôn đúng**, tức toàn phạm vi.

Trên màn hình **không có ô nhập biểu thức tự do nào**. Mọi lựa chọn là dropdown dựng từ `/metadata`. Việc ô đó không tồn tại chính là hình dạng phía UI của việc runtime không có expression language.

### Ví dụ thật

```jsonc
// "Việc của phòng tôi" — SCOPE (MANAGER, tasks, read)
{ "field": "department.id", "op": "eq", "value": { "ctx": "user.departmentId" } }

// "Việc tôi tạo hoặc được giao" — SCOPE (USER, tasks, write)
{ "any": [
    { "field": "createdBy.id", "op": "eq", "value": { "ctx": "user.id" } },
    { "field": "assignee.id",  "op": "eq", "value": { "ctx": "user.id" } }
]}

// "Không ai đọc bản nháp" — FILTER (blog_posts, read)
{ "field": "status", "op": "ne", "value": { "lit": "DRAFT" } }
```

### Quy tắc quan trọng nhất khi viết

> **Điều kiện mô tả những dòng ĐƯỢC PHÉP, không phải những dòng BỊ CẤM.**

Kể cả `FILTER`. Muốn "không ai đọc bản nháp" thì viết `status ne DRAFT` — tức là *"chỉ được đọc dòng không phải nháp"*. Viết `status eq DRAFT` sẽ cho kết quả **ngược hoàn toàn**: chỉ đọc được bản nháp.

Đây là chỗ sai đầu tiên của gần như tất cả mọi người. Đọc điều kiện thành câu **"được phép khi …"** trước khi lưu.

---

## 4. CHÍN CÁI BẪY

Mục quan trọng nhất tài liệu này. Tám trong chín cái đã thực sự xảy ra.

### Bẫy #1 — `not` không khớp dòng có giá trị rỗng

```jsonc
{ "not": { "field": "assignee.id", "op": "eq", "value": { "ctx": "user.id" } } }
```

Điều kiện này **không** nhận task chưa gán người.

Lý do: `assignee` là `null` → phép so sánh cho `UNKNOWN` → **`UNKNOWN` bị xử như từ chối**. Đây chính là cách `WHERE` của SQL hoạt động, và hệ thống cố ý làm giống hệt để hai trình biên dịch không bất đồng.

Muốn nhận thì **viết ra**:

```jsonc
{ "any": [
    { "not": { "field": "assignee.id", "op": "eq", "value": { "ctx": "user.id" } } },
    { "field": "assignee.id", "op": "isNull" }
]}
```

Builder tự cảnh báo và đề nghị thêm nhánh `isNull` mỗi khi bạn đặt `not` lên một trường nullable — **bấm nút đó**.

### Bẫy #2 — `WITH CHECK` biến trường thành bất biến

**Đã xảy ra thật.** Policy `write` với điều kiện `status ne PUBLISHED`, tên "chỉ sửa được bản nháp". Mở một bài `DRAFT`, đổi sang `PUBLISHED`, bấm lưu → **422**.

Vì sao: mặc định *một* điều kiện phục vụ **cả hai** vế.

- `USING` trên trạng thái **cũ**: `DRAFT ≠ PUBLISHED` → đúng → mở form được ✔
- `WITH CHECK` trên trạng thái **mới**: `PUBLISHED ≠ PUBLISHED` → sai → **422** ✘

Nói cách khác: **policy ràng buộc một trường có thể sửa sẽ biến trường đó thành bất biến.** "Chỉ sửa được draft" âm thầm thành "sửa được draft nhưng vĩnh viễn không publish được".

Phân biệt hai loại trường:

| Loại trường | Ví dụ | `WITH CHECK` giống `USING`? |
| :--- | :--- | :--- |
| **Sở hữu / vị trí** | `department`, `category`, `createdBy` | **Có** — đây chính là thứ chặn "đẩy đi chỗ khác để giấu" |
| **Trạng thái quy trình** | `status` | **Không** — luật nói về *dòng nào được chạm*, không nói *nó được trở thành gì* |

Cách sửa: trong form policy `write`, tắt switch **"Apply the same condition to the saved record"** rồi để trình dựng điều kiện thứ hai **trống** (= cho phép mọi trạng thái đích).

> Chỉ tắt khi điều kiện nói về trạng thái quy trình. Tắt trên một policy có cả `department.id` sẽ mở lại lỗ "chuyển phòng để giấu".

### Bẫy #3 — Điều kiện là "cho phép", không phải "cấm"

Xem mục 3. Nhắc lại ở đây vì nó đứng thứ hai về tần suất.

### Bẫy #4 — `FULL` **không** fail-closed

Câu hay bị hiểu nhầm: *"policy hỏng thì fail-closed nên an toàn"*. **Chỉ đúng với `NONE`.**

Với `defaultScope = FULL`, một role bị **mất** SCOPE duy nhất của nó (bị cách ly, bị tắt, bị xoá) sẽ rơi về "không có scope" → **không bị thu hẹp** → thấy **tất cả**.

Hệ quả thực tế:

- Tắt một policy để "thử" có thể **mở rộng** quyền chứ không thu hẹp.
- Ô đỏ `UNRESTRICTED` trên `/coverage` là thật, không phải cảnh báo hình thức.

`FULL` là công cụ **quá độ**, không phải đích. Khi cả ba role đã có SCOPE cho cả ba action (nhìn `/coverage` không còn ô đỏ), đổi một dòng trong policy set:

```java
@Override public DefaultScope defaultScope() { return DefaultScope.NONE; }
```

Từ đó `ADMIN` cần một SCOPE toàn phạm vi tường minh: `{"all": []}`.

### Bẫy #5 — Trường chỉ có giá trị sau khi lưu

`id`, `createdAt`, `updatedAt`, `completedAt` — khi tạo mới, chúng còn `null` tại thời điểm chưa flush. Một policy `write` vô hại như `createdAt >= today` sẽ **từ chối mọi lần tạo mới**.

Khai chúng trong `notCheckSafe()`. API sẽ từ chối **ngay lúc lưu policy**, kèm lý do — chứ không để bạn phát hiện qua một lần tạo mới bị từ chối vô cớ.

Lưu ý sự chính xác: `notCheckSafe` **chỉ áp cho mệnh đề `WITH CHECK`**. Dùng `createdAt` trong `USING` là hoàn toàn hợp lệ — vế đó luôn chạy trên dòng đã đọc từ database, dòng nào cũng có `createdAt`.

### Bẫy #6 — `404` chứ không `403`

Dòng ngoài phạm vi đọc **không tồn tại** với người gọi. `GET /api/tasks/1` trả `404`, không phải `403`.

Đây là chủ đích: `403` sẽ cho phép dò xem id nào có thật. Đừng "sửa" nó.

Hệ quả cho frontend: `getMany` trả về **ít phần tử hơn** số id được hỏi. Refine dùng `getMany` để phân giải nhãn khoá ngoại, nên phần tử vắng mặt hiện thành `—`. Đây là hành vi đúng.

### Bẫy #7 — Quên bước 5 thì không có lỗi nào cả

Quên truyền `rowLevel` vào response → `_can` rỗng → `access-control.ts` không có gì để đọc → **mọi nút hiện trên mọi dòng**. Người dùng bấm Edit, điền form, bấm Save, rồi mới nhận `422`.

Không có lỗi biên dịch, không có cảnh báo lint, không có gì trong log. Chỉ có trải nghiệm tệ.

### Bẫy #8 — Rolling deploy và resource node cũ chưa biết

**Đã xảy ra thật.** Hai node chạy hai phiên bản, dùng chung database. Node mới tạo policy cho `departments`; node cũ nhận thông báo qua event bus, không biết `departments`, và trước đây nó **ghi `enabled = false` vào bảng dùng chung** — vô hiệu hoá policy cho *mọi* node, và vẫn vô hiệu sau khi deploy xong.

Cộng với bẫy #4, cơ chế an toàn lại chính là chỗ rò rỉ.

Đã sửa: resource mà node không biết thì **bỏ qua và ghi log `WARN`**, không bao giờ cách ly. Nêu ở đây để bạn không "sửa lại" theo hướng cũ.

### Bẫy #9 — Đưa resource vào vòng phụ thuộc của authority cache

Nếu resource bạn quản lý nằm **bên trong** chuỗi mà `AuthorityCache` cần để tự nạp, Spring sẽ từ chối khởi tạo bean:

```
AuthorityCache → UserService → OrganizationService → RowLevelSecurity
              → RowLevelPrincipalResolver → AuthorizationService → AuthorityCache
```

Vòng này **đã được cắt một lần** tại `RowLevelPrincipalResolver` (tra `AuthorizationService` qua `ObjectProvider`), nên bạn thường không gặp lại. Nếu vẫn gặp: vòng chỉ là chuyện **thứ tự khởi tạo**, không phải logic — đường xác thực không bao giờ bị scope, vì nó chạy trước khi có principal và `scope()` trả toàn phạm vi khi không có principal.

`users` và `roles` **cố ý chưa đưa vào diện quản lý** vì lý do này: scope chúng là một quyết định thiết kế, không phải một thay đổi máy móc.

---

## 5. CHẨN ĐOÁN KHI NÓ KHÔNG NHƯ MONG ĐỢI

Bốn endpoint, đều cần `row_level_policies:read`.

### "Tại sao người này thấy/không thấy gì?"

```
GET /api/row_level_policies/explain?resource=tasks&action=read&userId=42
```

Liệt kê từng rule, nguồn của nó (`runtime#11` hay `code:TaskRowLevelPolicies`), **dạng đã biên dịch** của nó, rule nào đang áp dụng, và điều kiện hợp thành cuối cùng. Kèm `warnings` khi có role không có SCOPE trên resource `FULL`.

> Dạng hiển thị là dạng **sau chuẩn hoá**, không phải JSON bạn gõ. Chuẩn hoá là phần dễ gây bất ngờ nhất, nên hiện dạng gốc sẽ là hiện sai thứ.

Cần thêm `users:read` — mô phỏng quyền của người khác là đọc thông tin về người khác.

### "Tại sao tôi không thấy đúng bản ghi này?"

```
POST /api/row_level_policies/simulate
{ "resource": "tasks", "action": "write", "userId": 42, "recordId": 900 }
```

Trả về **ba trị**, không phải boolean:

```json
{ "allowed": false, "evaluatedAs": "UNKNOWN",
  "failedAt": "createdBy.id eq", "because": "createdBy is null, so the condition is UNKNOWN" }
```

`UNKNOWN` là câu trả lời **hay gặp nhất** và **khó đoán nhất** — thường là một khoá ngoại `null` (ví dụ `created_by_id` bị `SET NULL` khi người tạo nghỉ việc) làm cả nhánh thành unknown.

Đây là công cụ hữu ích nhất trong bốn cái. Không có nó, mỗi câu hỏi như trên là một buổi chiều đọc log.

### "Chỗ nào đang hở?"

```
GET /api/row_level_policies/coverage
```

Lưới role × action cho từng resource. Ô đỏ `UNRESTRICTED` = role đó **không bị thu hẹp gì cả**. Cũng hiển thị ngay dưới bảng trên màn hình Data scopes.

### "Policy nào đang hỏng?"

```
GET /actuator/health        (cần đăng nhập)
```

`rowLevelSecurity` chuyển **`DOWN`** kèm danh sách policy bị cách ly và lý do. Lý do cũng hiện ngay cạnh policy trên màn hình quản trị — vì người sửa được nó đang nhìn màn hình đó, không nhìn log.

Chiều cách ly khác nhau theo loại:

- `SCOPE` hỏng → chỉ vô hiệu (nhưng nhớ bẫy #4).
- `FILTER` hỏng → **chặn toàn bộ `(resource, action)`** cho tới khi sửa. Thà chặn hết còn hơn bỏ sót một lệnh cấm.

### Bỏ qua phân quyền có chủ đích

```java
rowLevel.asSystem("nightly-overdue-sweep", () -> { ... });
```

Log mức `INFO` kèm tên tác vụ và đếm vào counter `rowlevel.bypass{task=...}`. Việc chạy **không có người dùng nào** (khởi động, tác vụ theo lịch, luồng đăng nhập) đã tự động có toàn phạm vi — không cần gọi cái này.

---

## 6. CHECKLIST REVIEW

Dán vào PR description khi đưa một resource vào diện quản lý.

**Code**

- [ ] Entity có `@RowLevelResource("<tên>")`, trùng nguyên văn `routes.tsx` và mã quyền
- [ ] Có `RowLevelPolicySet` bean, đặt trong `module/<area>/<feature>/security/`
- [ ] `defaultScope()` đã cân nhắc và ghi lý do trong javadoc
- [ ] `fields()` chỉ chứa trường là **ranh giới bảo mật**, không có text tự do
- [ ] `notCheckSafe()` liệt kê đủ trường sinh lúc flush
- [ ] Repository đã đổi sang `SecuredRepository`
- [ ] Mọi phương thức đọc thêm trên repository đều có comment giải thích vì sao không scope
- [ ] `list` có `.and(...)` — **phạm vi trước, bộ lọc người dùng sau**
- [ ] `get` / `getMany` qua `byId` / `byIds` với `Action.READ`
- [ ] `create` gọi `flush()` **trước** `checkWritable`
- [ ] `update` đọc bằng `Action.WRITE` và gọi `checkWritable` trước khi lưu
- [ ] `delete` đọc bằng `Action.DELETE`, **không** dùng lại phạm vi đọc
- [ ] Controller tiêm `rowLevel` và truyền vào response ở list/getMany/get/create/update
- [ ] Response có trường `_can`
- [ ] Ứng dụng **khởi động được** (validator kiểm mọi `fields()` với JPA metamodel)

**Kiểm thử**

Bộ test lõi đã có sẵn và tự phủ resource mới qua registry. Ba test **không được bỏ**:

| Test | Canh điều gì |
| :--- | :--- |
| `CompilerAgreementTest` | SQL và bộ đánh giá in-memory chọn **đúng cùng một tập dòng** |
| `ScopeAlgebraTest` | Thêm role **không bao giờ** làm mất dòng |
| `SecuredRepositoryApiTest` | Đường đọc không an toàn **không biên dịch được** |

Nếu resource của bạn có kiểu trường mới (enum lạ, kiểu ngày khác), **thêm cây điều kiện vào fixture của `CompilerAgreementTest`** — đặc biệt các tổ hợp `not` × trường nullable × ctx `null` × tập rỗng.

**Vận hành**

- [ ] `/coverage` hiện resource mới
- [ ] Danh sách trả về **đúng như trước** khi chưa có policy nào (`FULL` = no-op)
- [ ] Đã tạo thử một policy và xác nhận nó thu hẹp đúng
- [ ] `/actuator/health` vẫn `UP`

---

## 7. PHỤ LỤC

### Toán tử

| Toán tử | Toán hạng | Áp cho | Phủ định |
| :--- | :--- | :--- | :--- |
| `eq` / `ne` | 1 | mọi kiểu | lẫn nhau |
| `in` / `notIn` | tập | mọi kiểu | lẫn nhau |
| `lt` / `lte` / `gt` / `gte` | 1 | số, ngày | `gte` / `gt` / `lte` / `lt` |
| `between` | 2 | số, ngày | (khai triển thành `all[gte, lte]`) |
| `like` / `notLike` | 1 | chuỗi | lẫn nhau |
| `isNull` / `isNotNull` | **0** | trường nullable | lẫn nhau |

`isNull` / `isNotNull` **không mang `value`**. Chúng cũng là hai toán tử duy nhất **không bao giờ** cho `UNKNOWN`.

Enum và chuỗi **không có** toán tử so sánh thứ tự — sắp xếp enum sẽ so theo tên chữ cái, trông như hoạt động nhưng trả lời một câu hỏi khác.

### Khoá ngữ cảnh dựng sẵn

| Khoá | Kiểu | Ghi chú |
| :--- | :--- | :--- |
| `user.id` | `Long` | |
| `user.organizationId` | `Long` | có thể `null` → điều kiện thành `UNKNOWN` |
| `user.departmentId` | `Long` | như trên |
| `user.roleCodes` | `Set<String>` | **chỉ dùng được với `in` / `notIn`** |
| `today` | `LocalDate` | phân giải trên **server** |
| `now` | `Instant` | phân giải trên **server** |

Thêm khoá của ứng dụng: thêm một bean `RowLevelContextProvider`, khai `key()`, `type()`, `resolve(principal)`. Engine không phải sửa. **Không được truy vấn database trong `resolve`** — nó chạy trên đường đi của mọi danh sách.

### Bảng ba trị

|  | cho `TRUE` khi | cho `UNKNOWN` khi | cho `FALSE` khi |
| :--- | :--- | :--- | :--- |
| `all` (AND) | tất cả `TRUE` | không có `FALSE` và có `UNKNOWN` | có ít nhất một `FALSE` |
| `any` (OR) | có ít nhất một `TRUE` | không có `TRUE` và có `UNKNOWN` | tất cả `FALSE` |
| `not` | vế trong `FALSE` | vế trong `UNKNOWN` | vế trong `TRUE` |

**Lá:**

- Trường là `null`, toán tử không phải `isNull`/`isNotNull` → `UNKNOWN`
- Giá trị ngữ cảnh là `null`, tương tự → `UNKNOWN`
- `in` với tập rỗng → `FALSE`; `notIn` với tập rỗng → `TRUE`

> **Dòng chỉ được nhận khi kết quả là `TRUE`. `UNKNOWN` bị xử như từ chối.**

### Trạng thái hiện tại

| Resource | `defaultScope` | Ghi chú |
| :--- | :--- | :--- |
| `tasks` | `FULL` | đầy đủ nhất, đọc file này để làm mẫu |
| `blog_posts` | `FULL` | có `reference` tới `categories` |
| `categories` | `FULL` | nhỏ nhất |
| `organizations` | `FULL` | scope trên `id` là luật tự nhiên ở đây |
| `departments` | `FULL` | có `reference` tới `organizations` |

Chưa quản lý, **có lý do**: `users` và `roles` (bẫy #9), `notifications` (đã scope theo người nhận bằng cơ chế riêng, đơn giản hơn), `permissions` (catalogue chỉ đọc, do migration ghi).

### Đọc thêm

| Cần gì | Đọc ở đâu |
| :--- | :--- |
| Vì sao thiết kế như vậy | `docs/row_level_role_final.md` |
| Tóm tắt kiến trúc trong repo | `CLAUDE.md`, mục *Row-level security* |
| Mẫu code đầy đủ nhất | `module/bpm/task/` |
| Mẫu có `reference` | `module/catalog/department/` |
| Hợp đồng API | `CLAUDE.md`, mục *The API contract is the data provider's dialect* |
