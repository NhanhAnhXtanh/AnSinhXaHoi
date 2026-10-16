package com.dth.frw.module.asxh.unit.service;

import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import com.dth.frw.module.asxh.unit.api.dto.ReportUnitPatchRequest;
import com.dth.frw.module.asxh.unit.api.dto.ReportUnitRequest;
import com.dth.frw.module.asxh.unit.repo.ReportUnitRepository;
import com.dth.frw.module.asxh.unit.repo.ReportUnitSpecifications;
import com.dth.frw.module.security.rowlevel.service.RowLevelSecurity;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.rowlevel.Action;
import com.dth.frw.shared.web.ListParams;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import org.hibernate.Hibernate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Danh mục đơn vị báo cáo — port nghiệp vụ UC-01..03 từ {@code OrganizationEntityListener}
 * và {@code OrganizationDetailView} của bản Jmix.
 *
 * <p>Đơn vị chưa đặt dưới quản lý row-level (không có {@code @RowLevelResource}), nên
 * {@link RowLevelSecurity} trả phạm vi không giới hạn; vẫn gọi qua nó để khi bật
 * row-level cho đơn vị thì chỉ cần thêm annotation và bộ chính sách.
 *
 * <p>Các slice khác (thiết lập kỳ, phiếu nhập) lấy đơn vị qua {@link #get(Long)} /
 * {@link #getMany(Collection)} của service này, không qua repository.
 */
@Service
@Transactional(readOnly = true)
public class ReportUnitService {

    private static final String RESOURCE = "Đơn vị";

    /** Thuộc tính được sắp xếp; cái khác bị bỏ qua. */
    private static final Set<String> SORTABLE = Set.of(
            "id", "budgetCode", "name", "unitType", "block", "active", "receivesReports",
            "createdAt", "updatedAt");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.asc("budgetCode"), Sort.Order.asc("id"));

    /** Chặn vòng lặp vô hạn nếu dữ liệu cũ lỡ có chu trình. */
    private static final int MAX_DEPTH = 1_000;

    private final ReportUnitRepository repository;
    private final RowLevelSecurity rowLevel;

    public ReportUnitService(ReportUnitRepository repository, RowLevelSecurity rowLevel) {
        this.repository = repository;
        this.rowLevel = rowLevel;
    }

    public Page<ReportUnit> list(ListParams params) {
        Page<ReportUnit> page = repository.findAll(
                rowLevel.scope(ReportUnit.class, Action.READ)
                        .and(ReportUnitSpecifications.from(params)),
                params.pageable(SORTABLE, DEFAULT_SORT));
        page.getContent().forEach(ReportUnitService::initializeParent);
        return page;
    }

    public ReportUnit get(Long id) {
        return initializeParent(repository.findOne(rowLevel.byId(ReportUnit.class, Action.READ, id))
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, id)));
    }

    /** Giải các id của {@code getMany} trong một câu truy vấn. */
    public List<ReportUnit> getMany(Collection<Long> ids) {
        List<ReportUnit> units = repository.findAll(rowLevel.byIds(ReportUnit.class, Action.READ, ids));
        units.forEach(ReportUnitService::initializeParent);
        return units;
    }

    @Transactional
    public ReportUnit create(ReportUnitRequest request) {
        String budgetCode = request.budgetCode().trim();
        requireBudgetCodeAvailable(budgetCode);

        ReportUnit parent = request.parent() == null || request.parent().id() == null
                ? null
                : parent(request.parent().id());

        ReportUnitType type = request.unitType();
        ReportBlock block = request.block() != null ? request.block() : type.defaultBlock();

        ReportUnit unit = new ReportUnit(budgetCode, request.name().trim(), parent, type, block);
        unit.setActive(request.active() == null || request.active());
        unit.setReceivesReports(request.receivesReports() == null || request.receivesReports());

        ReportUnit saved = repository.persist(unit);
        repository.flush();
        rowLevel.checkWritable(saved);
        return initializeParent(saved);
    }

    @Transactional
    public ReportUnit update(Long id, ReportUnitPatchRequest request) {
        ReportUnit unit = repository.findOne(rowLevel.byId(ReportUnit.class, Action.WRITE, id))
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, id));

        // BR-01.1: mã bất biến. Form sửa gửi lại nguyên bản ghi, nên mã trùng mã cũ
        // là bình thường; chỉ mã KHÁC mới bị từ chối.
        if (request.budgetCode() != null
                && !request.budgetCode().trim().equalsIgnoreCase(unit.getBudgetCode())) {
            throw new ConflictException("Mã đơn vị không được thay đổi sau khi đã lưu.");
        }

        // Cấp trên được giải và kiểm tra vòng lặp TRƯỚC khi ghi vào entity — cùng lý do
        // với DepartmentService.update: ghi trước rồi truy vấn thì Hibernate auto-flush
        // có thể đẩy bản ghi dở dang xuống DB trước khi kịp báo lỗi.
        boolean parentChanged = false;
        ReportUnit targetParent = unit.getParent();
        if (request.parent() != null) {
            targetParent = request.parent().id() == null ? null : parent(request.parent().id());
            requireNoCycle(unit, targetParent);
            parentChanged = true;
        }

        boolean deactivating = unit.isActive() && Boolean.FALSE.equals(request.active());

        if (parentChanged) {
            unit.setParent(targetParent);
        }
        if (request.name() != null) {
            unit.setName(request.name().trim());
        }
        if (request.unitType() != null) {
            unit.setUnitType(request.unitType());
        }
        if (request.block() != null) {
            unit.setBlock(request.block());
        }
        if (request.active() != null) {
            unit.setActive(request.active());
        }
        if (request.receivesReports() != null) {
            unit.setReceivesReports(request.receivesReports());
        }

        rowLevel.checkWritable(unit);
        ReportUnit saved = repository.persist(unit);

        if (deactivating) {
            // BR-02.1: ngừng hoạt động lan xuống toàn bộ cây con; kích hoạt lại không lan.
            repository.deactivateDescendants(saved.getId());
            // TODO: vô hiệu tài khoản gắn các đơn vị này (BR-02.2, UC-70) — bảng users
            // chưa có liên kết tới đơn vị báo cáo; làm khi nối tài khoản đơn vị.
        }
        return initializeParent(saved);
    }

    @Transactional
    public ReportUnit delete(Long id) {
        ReportUnit unit = repository.findOne(rowLevel.byId(ReportUnit.class, Action.DELETE, id))
                .orElseThrow(() -> new ResourceNotFoundException(RESOURCE, id));
        initializeParent(unit);

        if (repository.existsByParentId(unit.getId())) {
            throw new ConflictException(
                    "Không thể xoá đơn vị còn đơn vị cấp dưới. Hãy chuyển hoặc xoá các đơn vị cấp dưới trước.");
        }

        repository.remove(unit);
        try {
            // Flush ngay để khoá ngoại RESTRICT từ bảng khác (thiết lập kỳ, phiếu nhập…)
            // báo lỗi ở đây, đổi được thành thông báo tiếng Việt thay cho câu chung của base.
            repository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException(
                    "Không thể xoá đơn vị đang được sử dụng (thiết lập kỳ, phiếu nhập…). "
                            + "Hãy chuyển đơn vị sang ngừng hoạt động.");
        }
        return unit;
    }

    private ReportUnit parent(Long parentId) {
        return repository.findOne(rowLevel.byId(ReportUnit.class, Action.READ, parentId))
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị cấp trên", parentId));
    }

    /**
     * BR-01.2: cây không được có chu trình — kể cả chọn chính mình làm cấp trên.
     * Đi ngược từ cấp trên mới lên gốc; gặp lại chính đơn vị là có vòng.
     */
    private void requireNoCycle(ReportUnit unit, ReportUnit newParent) {
        ReportUnit cursor = newParent;
        int depth = 0;
        while (cursor != null && depth++ < MAX_DEPTH) {
            if (cursor.getId().equals(unit.getId())) {
                throw new ConflictException(
                        "Đơn vị cha không hợp lệ: không được chọn chính đơn vị này hoặc một đơn vị cấp dưới của nó.");
            }
            cursor = cursor.getParent();
        }
    }

    private void requireBudgetCodeAvailable(String budgetCode) {
        repository.findByBudgetCodeIgnoreCase(budgetCode).ifPresent(existing -> {
            throw new ConflictException("Mã đơn vị này đã tồn tại. Vui lòng nhập mã khác.");
        });
    }

    /**
     * Nạp cấp trên trong transaction: {@code open-in-view=false} nên controller đọc
     * {@code parent.name} ngoài transaction sẽ gặp proxy chưa nạp. Nhiều đơn vị chung
     * một cấp trên chỉ tốn một câu select nhờ persistence context.
     */
    private static ReportUnit initializeParent(ReportUnit unit) {
        if (unit.getParent() != null) {
            Hibernate.initialize(unit.getParent());
        }
        return unit;
    }
}
