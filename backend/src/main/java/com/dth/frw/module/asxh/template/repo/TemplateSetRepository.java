package com.dth.frw.module.asxh.template.repo;

import com.dth.frw.domain.asxh.template.TemplateSet;
import com.dth.frw.domain.asxh.template.TemplateStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Bộ mẫu. Không thuộc row-level nên dùng {@link JpaRepository} thường, như
 * {@code RoleRepository} của base.
 */
public interface TemplateSetRepository
        extends JpaRepository<TemplateSet, Long>, JpaSpecificationExecutor<TemplateSet> {

    /** Cho kiểm tra trùng tên — so không phân biệt hoa thường như chỉ mục duy nhất. */
    Optional<TemplateSet> findFirstByNameIgnoreCase(String name);

    /** Số biểu của từng bộ mẫu trong trang đang hiện: {@code [setId, count]}. */
    @Query("select t.templateSet.id, count(t) from Template t "
            + "where t.templateSet.id in :setIds group by t.templateSet.id")
    List<Object[]> countTemplatesBySet(@Param("setIds") Collection<Long> setIds);

    /** Bộ mẫu nào có ít nhất một phiên bản ở trạng thái cho trước ("đang sử dụng"). */
    @Query("select distinct t.templateSet.id from TemplateVersion v join v.template t "
            + "where t.templateSet.id in :setIds and v.status = :status")
    List<Long> setIdsWithVersionStatus(@Param("setIds") Collection<Long> setIds,
                                       @Param("status") TemplateStatus status);
}
