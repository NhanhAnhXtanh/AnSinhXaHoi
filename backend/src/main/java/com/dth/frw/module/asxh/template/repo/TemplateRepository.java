package com.dth.frw.module.asxh.template.repo;

import com.dth.frw.domain.asxh.template.Template;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TemplateRepository
        extends JpaRepository<Template, Long>, JpaSpecificationExecutor<Template> {

    /** Kiểm tra trùng tên ngắn trong cùng bộ mẫu, không phân biệt hoa thường. */
    Optional<Template> findFirstByTemplateSetIdAndShortNameIgnoreCase(Long templateSetId, String shortName);

    long countByTemplateSetId(Long templateSetId);

    /** Thứ tự tab lớn nhất trong bộ mẫu — biểu mới mặc định đứng cuối. */
    @Query("select coalesce(max(t.sortOrder), 0) from Template t where t.templateSet.id = :setId")
    Integer maxSortOrder(@Param("setId") Long setId);

    /**
     * Khoá dòng biểu trong giao dịch hiện tại.
     *
     * <p>Mọi thao tác đổi trạng thái trong chuỗi phiên bản (ban hành, khoá,
     * thu hồi, xoá, tạo bản kế tiếp) đều kiểm tra "các bản khác của biểu đang ở
     * đâu" rồi mới ghi; khoá dòng cha là thứ khiến hai người bấm cùng lúc không
     * cùng lọt qua phép kiểm tra đó.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Template t where t.id = :id")
    Optional<Template> lockById(@Param("id") Long id);

    /** Số thứ tự kế tiếp cho mã nội bộ BM-xxxxxx. */
    @Query(value = "select nextval('asxh_template_code_seq')", nativeQuery = true)
    Long nextCodeNumber();
}
