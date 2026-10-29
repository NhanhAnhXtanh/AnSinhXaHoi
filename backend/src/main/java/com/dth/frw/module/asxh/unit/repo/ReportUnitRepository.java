package com.dth.frw.module.asxh.unit.repo;

import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.shared.data.SecuredRepository;
import java.util.Optional;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Một {@link SecuredRepository}: không có {@code findById}/{@code findAll()} để gọi
 * nhầm — mọi lần đọc đi qua một {@code Specification}.
 */
public interface ReportUnitRepository extends SecuredRepository<ReportUnit, Long> {

    /**
     * Kiểm tra trùng mã QHNS (không phân biệt hoa thường). Cố ý không giới hạn
     * phạm vi: kiểm tra duy nhất mà không thấy hết dòng thì không còn là kiểm tra.
     */
    Optional<ReportUnit> findByBudgetCodeIgnoreCase(String budgetCode);

    /** Còn đơn vị cấp dưới trực tiếp không — chặn xoá với thông báo rõ ràng. */
    boolean existsByParentId(Long parentId);

    /**
     * Ngừng hoạt động toàn bộ cây con của một đơn vị (BR-02.1: ngừng hoạt động lan
     * xuống mọi cấp). Kích hoạt lại thì <b>không</b> lan, nên không có hàm ngược.
     *
     * <p>CTE đệ quy trong một câu lệnh thay vì duyệt cây trong Java. Có
     * {@code UNION} (không {@code ALL}) để nếu dữ liệu cũ lỡ có vòng thì truy vấn
     * vẫn dừng.
     *
     * @return số đơn vị con vừa chuyển sang ngừng hoạt động
     */
    @Modifying(flushAutomatically = true)
    @Query(nativeQuery = true, value = """
            WITH RECURSIVE tree(id) AS (
                SELECT u.id FROM asxh_report_units u WHERE u.parent_id = :unitId
                UNION
                SELECT c.id FROM asxh_report_units c JOIN tree t ON c.parent_id = t.id
            )
            UPDATE asxh_report_units
               SET active = FALSE, updated_at = now()
             WHERE id IN (SELECT id FROM tree) AND active = TRUE
            """)
    int deactivateDescendants(@Param("unitId") Long unitId);
}
