# TÀI LIỆU BÀN GIAO: KIẾN TRÚC PHÂN QUYỀN DÒNG DỮ LIỆU ĐỘNG (DYNAMIC RUNTIME RLS) TRONG SPRING BOOT

Nội dung này tổng hợp toàn bộ giải pháp kiến trúc, mô hình dữ liệu và mã nguồn triển khai thư viện quản lý Metadata Entity hỗ trợ Phân quyền dòng dữ liệu động (Row-Level Security) ở chế độ Runtime cho hệ thống Enterprise. Tài liệu này được chuẩn hóa để bàn giao làm ngữ cảnh phát triển tiếp theo.

---

## 1. TỔNG QUAN KIẾN TRÚC (ARCHITECTURE OVERVIEW)

Hệ thống dịch chuyển toàn bộ logic kiểm tra quyền dòng dữ liệu (Cả quyền Đọc - READ và các quyền Ghi - UPDATE/DELETE/CLAIM) từ tầng API/Service xuống **tầng JPA Repository trung tâm** bằng cách mở rộng `SimpleJpaRepository`.

### Nguyên lý hoạt động:
1. **Dynamic Expression Input:** Định nghĩa quy tắc bảo mật động dưới dạng cấu trúc cây logic (Trường - Toán tử - Biểu thức giá trị SpEL). Biểu thức này hỗ trợ biến Session (`#session.userId`, `#session.current_department`) và gọi Spring Bean Function (`@userService.isInGroup(...)`).
2. **Compile-free Implementation:** Tự động hóa việc đính kèm mệnh đề `WHERE` vào câu lệnh SQL thông qua `JPA Specification` (`CriteriaBuilder`) tại thời điểm Runtime mà không cần hard-code `@PreAuthorize` hay sửa mã nguồn Java khi thay đổi vai trò.
3. **Atomic Validation & Audit Trail via SELECT-Before-WRITE:** Tuân thủ chuẩn cơ chế quản lý thực thể của Hibernate (Persistence Context), hỗ trợ ghi log lịch sử thay đổi (Audit trail), phân tách rạch ròi mã lỗi `403 Forbidden` (Sai quyền) và `404 Not Found` (Dữ liệu không tồn tại).

---

## 2. MÔ HÌNH DỮ LIỆU CẤU HÌNH RUNTIME (DATABASE DESIGN)

Hệ thống quản trị cấu hình phân quyền thông qua ma trận lưu trữ động dưới Database:

```sql
-- Bảng lưu trữ cấu hình luật RLS động do Admin thiết lập tại Runtime (Hỗ trợ React Query Builder)
CREATE TABLE row_level_role (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    entity_name VARCHAR(100) NOT NULL,       -- Ví dụ: TASK, INVOICE
    permission_code VARCHAR(100) NOT NULL,   -- Ví dụ: TASK:READ, TASK:UPDATE, TASK:CLAIM
    role_name VARCHAR(50) NOT NULL,          -- Ví dụ: ROLE_MANAGER, ROLE_EMPLOYEE
    field_name VARCHAR(100) NOT NULL,         -- Tên thuộc tính Java trong Entity (Ví dụ: departmentId)
    operator VARCHAR(50) NOT NULL,           -- EQUAL, IN, LIKE, NOT_EQUAL, IS_NULL
    value_expression TEXT NOT NULL,          -- Biểu thức SpEL (Ví dụ: '#session.current_department')
    status BOOLEAN DEFAULT TRUE,             -- Bật/tắt luật tức thì tại Runtime
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 3. THIẾT KẾ METADATA & CONTEXT NGỮ CẢNH

### 3.1. Metadata Annotation Đánh Dấu Entity
```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface SecuredEntity {
    String name(); // Mã định danh Entity khớp với cột entity_name trong DB (Ví dụ: "TASK")
}
```

### 3.2. Cấu trúc Đối tượng Lưu trữ Session động của User
```java
public class UserSecurityContext {
    private String userId;
    private Set<String> roles;
    // Map chứa toàn bộ biến phiên làm việc do Dev khai báo lúc User login (Department, Org, Team,...)
    private Map<String, Object> session = new HashMap<>();

    public String getUserId() { return userId; }
    public Set<String> getRoles() { return roles; }
    public Map<String, Object> getSession() { return session; }
}
```

---

## 4. BỘ PHÂN GIẢI SPEL ENGINE AN TOÀN (SANDBOX SPEL)

Bộ xử lý trung tâm biên dịch các chuỗi cấu hình động của Admin thành giá trị dữ liệu thực tế tại thời điểm thực thi.

```java
@Component
public class RlsSecurityEngine {

    @Autowired
    private ApplicationContext applicationContext;

    /**
     * Hàm Validate kiểm tra lỗi cú pháp biểu thức từ Admin UI
     */
    public boolean validateExpression(String expressionStr) {
        try {
            ExpressionParser parser = new SpelExpressionParser();
            Expression expression = parser.parseExpression(expressionStr);
            StandardEvaluationContext mockContext = new StandardEvaluationContext();
            mockContext.setBeanResolver(new BeanFactoryResolver(applicationContext));
            mockContext.setVariable("session", new HashMap<String, Object>());
            expression.getValue(mockContext);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Hàm phân giải biểu thức an toàn, nạp biến session và Spring Beans
     */
    public Object evaluate(String expressionStr, UserSecurityContext userContext) {
        ExpressionParser parser = new SpelExpressionParser();
        StandardEvaluationContext context = new StandardEvaluationContext();
        
        // Đăng ký bộ phân giải Spring Beans để gọi hàm tự viết (Ví dụ: @departmentService)
        context.setBeanResolver(new BeanFactoryResolver(applicationContext));
        
        // Chỉ định biến #session vào ngữ cảnh thực thi
        context.setVariable("session", userContext.getSession());
        
        return parser.parseExpression(expressionStr).getValue(context);
    }
}
```

---

## 5. TẦNG CHUYỂN ĐỔI SANG JPA SPECIFICATION

Lớp xử lý ánh xạ từ cấu trúc dữ liệu Rule JSON lưu dưới cơ sở dữ liệu sang đối tượng `Predicate` của JPA để tạo câu lệnh SQL `WHERE`.

```java
@Component
public class RlsSpecificationBuilder {

    @Autowired
    private RlsSecurityEngine rlsSecurityEngine;

    public <T> Specification<T> buildSpecification(List<RlsRuleDetail> rules, UserSecurityContext userContext) {
        return (root, query, cb) -> {
            if (rules == null || rules.isEmpty()) {
                return cb.disjunction(); // Mặc định chặn tuyệt đối nếu không cấu hình luật (Fail-Safe)
            }

            List<Predicate> predicates = new ArrayList<>();

            for (RlsRuleDetail rule : rules) {
                // Giải mã SpEL thành giá trị tĩnh tại Runtime
                Object resolvedValue = rlsSecurityEngine.evaluate(rule.getValueExpression(), userContext);

                switch (rule.getOperator().toUpperCase()) {
                    case "EQUAL":
                    case "=":
                        predicates.add(cb.equal(root.get(rule.getField()), resolvedValue));
                        break;
                    case "IN":
                        if (resolvedValue instanceof Collection) {
                            predicates.add(root.get(rule.getField()).in((Collection<?>) resolvedValue));
                        }
                        break;
                    case "LIKE":
                        predicates.add(cb.like(root.get(rule.getField()), "%" + resolvedValue + "%"));
                        break;
                    case "NOT_EQUAL":
                    case "!=":
                        predicates.add(cb.notEqual(root.get(rule.getField()), resolvedValue));
                        break;
                    case "IS_NULL":
                        predicates.add(cb.isNull(root.get(rule.getField())));
                        break;
                }
            }
            // Kết hợp các luật của cùng một Role bằng phép toán logic AND (Hoặc kết hợp OR các Role khác nhau)
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
```

---

## 6. LỚP CUSTOM BASE REPOSITORY ĐỒNG NHẤT (XỬ LÝ BATCH CHUYÊN SÂU)

Lớp core ghi đè toàn bộ hành vi truy vấn dữ liệu gốc của Spring Data JPA. Hỗ trợ tùy chọn **Optional Batch Update Strategy** qua tham số cấu hình: **Rollback All** (Hủy toàn bộ nếu dính lỗi) hoặc **Partial Success** (Lưu phần đúng, bóc tách báo cáo ID lỗi 403/404 lên ThreadLocal Context).

```java
public class SecuredRepositoryImpl<T, ID> extends SimpleJpaRepository<T, ID> {

    private final Class<T> domainClass;
    private final EntityManager entityManager;
    private final RlsSpecificationBuilder rlsSpecificationBuilder;
    private final RuntimeRlsRuleRepository ruleRepository;
    private final RlsBatchProperties batchProperties;

    public SecuredRepositoryImpl(JpaEntityInformation<T, ?> entityInformation, 
                                 EntityManager entityManager,
                                 RlsSpecificationBuilder rlsSpecificationBuilder,
                                 RuntimeRlsRuleRepository ruleRepository,
                                 RlsBatchProperties batchProperties) {
        super(entityInformation, entityManager);
        this.domainClass = entityInformation.getJavaType();
        this.entityManager = entityManager;
        this.rlsSpecificationBuilder = rlsSpecificationBuilder;
        this.ruleRepository = ruleRepository;
        this.batchProperties = batchProperties;
    }

    // --- LUỒNG READ TỰ ĐỘNG ---
    @Override
    public List<T> findAll() { return super.findAll(getDynamicRlsSpecification("READ")); }

    @Override
    public Page<T> findAll(Pageable pageable) { return super.findAll(getDynamicRlsSpecification("READ"), pageable); }

    // --- LUỒNG WRITE ĐƠN LẺ TỰ ĐỘNG ---
    @Override
    @Transactional
    public <S extends T> S save(S entity) {
        if (!domainClass.isAnnotationPresent(SecuredEntity.class)) return super.save(entity);
        ID id = (ID) entityManager.getEntityManagerFactory().getPersistenceUnitUtil().getIdentifier(entity);
        if (id != null) validateWritePermission(id, "UPDATE");
        return super.save(entity);
    }

    // --- LUỒNG HÀNH ĐỘNG TÙY CHỈNH ĐỘNG (Ví dụ: CLAIM, REASSIGN) ---
    @Transactional
    public void executeCustomAction(ID id, String customAction, Consumer<T> businessLogic) {
        T entity = validateWritePermission(id, customAction);
        businessLogic.accept(entity);
        super.save(entity);
    }

    // --- LUỒNG XỬ LÝ BATCH UPDATE OPTIONAL (ROLLBACK VS PARTIAL) ---
    @Override
    @Transactional
    public <S extends T> List<S> saveAll(Iterable<S> entities) {
        return saveAll(entities, batchProperties.isRollbackOnError());
    }

    @Transactional
    public <S extends T> List<S> saveAll(Iterable<S> entities, boolean rollbackOnError) {
        if (!domainClass.isAnnotationPresent(SecuredEntity.class)) return super.saveAll(entities);

        List<ID> inputIds = new ArrayList<>();
        List<S> updateEntities = new ArrayList<>();
        List<S> createEntities = new ArrayList<>();

        for (S entity : entities) {
            ID id = (ID) entityManager.getEntityManagerFactory().getPersistenceUnitUtil().getIdentifier(entity);
            if (id == null) createEntities.add(entity);
            else { inputIds.add(id); updateEntities.add(entity); }
        }

        List<S> finalEntitiesToSave = new ArrayList<>(createEntities);

        if (!inputIds.isEmpty()) {
            BatchValidationResult<S, ID> result = validateBatchWritePermission(inputIds, updateEntities);
            if (result.hasError()) {
                if (rollbackOnError) {
                    throw new BatchSecurityException("Lô dữ liệu chứa bản ghi lỗi. Tiến trình bị hủy.", 
                            result.getForbiddenIds(), result.getNotFoundIds());
                } else {
                    finalEntitiesToSave.addAll(result.getValidEntities());
                    BatchErrorContext.set(result.getForbiddenIds(), result.getNotFoundIds()); // Lưu ThreadLocal
                }
            } else {
                finalEntitiesToSave.addAll(updateEntities);
            }
        }
        return super.saveAll(finalEntitiesToSave);
    }

    private T validateWritePermission(ID id, String action) {
        Specification<T> rlsSpec = getDynamicRlsSpecification(action);
        Specification<T> idSpec = (root, query, cb) -> cb.equal(root.get("id"), id);
        Optional<T> securedEntity = super.findOne(Specification.where(idSpec).and(rlsSpec));
        if (securedEntity.isEmpty()) {
            if (super.existsById(id)) throw new AccessDeniedException("Lỗi 403: Sai quyền dòng dữ liệu.");
            else throw new EntityNotFoundException("Lỗi 404: Không tồn tại bản ghi.");
        }
        return securedEntity.get();
    }

    private <S extends T> BatchValidationResult<S, ID> validateBatchWritePermission(List<ID> inputIds, List<S> updateEntities) {
        Specification<T> rlsSpec = getDynamicRlsSpecification("UPDATE");
        Specification<T> idInSpec = (root, query, cb) -> root.get("id").in(inputIds);
        List<T> securedEntities = super.findAll(Specification.where(idInSpec).and(rlsSpec));
        
        BatchValidationResult<S, ID> result = new BatchValidationResult<>();
        if (securedEntities.size() == inputIds.size()) {
            result.setValidEntities(updateEntities);
            return result;
        }

        List<ID> validIds = securedEntities.stream()
                .map(e -> (ID) entityManager.getEntityManagerFactory().getPersistenceUnitUtil().getIdentifier(e))
                .collect(Collectors.toList());

        List<S> validEntities = updateEntities.stream()
                .filter(e -> validIds.contains((ID) entityManager.getEntityManagerFactory().getPersistenceUnitUtil().getIdentifier(e)))
                .collect(Collectors.toList());
        result.setValidEntities(validEntities);

        List<ID> failedIds = inputIds.stream().filter(id -> !validIds.contains(id)).collect(Collectors.toList());
        List<T> existingEntities = super.findAll((root, query, cb) -> root.get("id").in(failedIds));
        List<ID> existingIds = existingEntities.stream()
                .map(e -> (ID) entityManager.getEntityManagerFactory().getPersistenceUnitUtil().getIdentifier(e))
                .collect(Collectors.toList());

        for (ID failedId : failedIds) {
            if (existingIds.contains(failedId)) result.addForbiddenId(failedId);
            else result.addNotFoundId(failedId);
        }
        return result;
    }

    private Specification<T> getDynamicRlsSpecification(String action) {
        SecuredEntity anno = domainClass.getAnnotation(SecuredEntity.class);
        UserSecurityContext userContext = (UserSecurityContext) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        List<RlsRuleDetail> activeRules = ruleRepository.getRulesAtRuntime(anno.name(), action, userContext.getRoles());
        return rlsSpecificationBuilder.buildSpecification(activeRules, userContext);
    }
}
```

---

## 7. BIÊN BẢN CẤU HÌNH BIỂU THỨC KỊCH BẢN MẪU (USE CASE)

Đối với bài toán quản lý tác vụ (`SecuredEntity(name = "TASK")`), cấu hình lưu dưới dạng JSON tại Runtime từ React Query Builder tương ứng với logic nghiệp vụ như sau:

| Quyền hạn nghiệp vụ | Action | Trường kiểm tra (`field`) | Toán tử (`operator`) | Biểu thức SpEL (`valueExpression`) |
| :--- | :--- | :--- | :--- | :--- |
| **Trưởng phòng Đọc việc của phòng** | `READ` | `departmentId` | `EQUAL` | `#session.current_department` |
| **Trưởng phòng chỉ Sửa việc của mình** | `UPDATE` | `createdBy` | `EQUAL` | `#session.userId` |
| **Nhân viên Đọc việc của mình** | `READ` | `assigneeId` | `EQUAL` | `#session.userId` |
| **Nhân viên Sửa việc của mình** | `UPDATE` | `assigneeId` | `EQUAL` | `#session.userId` |
| **Nhân viên CLAIM việc chưa gán** | `CLAIM` | Nhóm logic phức tạp:<br>1. `departmentId`<br>2. `assigneeId`<br>3. `status` | <br>`EQUAL`<br>`IS_NULL`<br>`EQUAL` | <br>`#session.current_department`<br>`null`<br>`'UNASSIGNED'` |

---

## 8. HƯỚNG PHÁT TRIỂN TIẾP THEO (NEXT STEPS FOR CLAUDE)
1. **Thiết kế Cơ chế Cache Eviction:** Tích hợp Redis Pub/Sub để khi Admin cập nhật cấu hình RLS trên UI, các Node Server lập tức xóa sạch Cache cũ của `RuntimeRlsRuleRepository`.
2. **Xây dựng Custom SpEL Sandbox:** Triển khai một `SimpleEvaluationContext` nghiêm ngặt kết hợp Regex whitelist để loại bỏ hoàn toàn lỗ hổng bảo mật **SpEL Injection** khi Admin tự viết code thủ công.
3. **Phát triển Tầng Audit Log chuyên sâu:** Xây dựng một cơ chế tự động ghi log vào bảng `task_history` tận dụng tập dữ liệu cũ thu được từ câu lệnh SELECT kiểm tra trước tại luồng `saveAll` Partial Success.
