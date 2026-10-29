package com.dth.frw.module.asxh.template.repo;

import com.dth.frw.domain.asxh.template.TemplateStatus;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TemplateVersionRepository
        extends JpaRepository<TemplateVersion, Long>, JpaSpecificationExecutor<TemplateVersion> {

    /** Cả chuỗi phiên bản của một biểu, theo số thứ tự. */
    List<TemplateVersion> findByTemplateIdOrderByVersionNoAsc(Long templateId);

    long countByTemplateId(Long templateId);

    /**
     * Id biểu của một phiên bản, đọc dạng giá trị (không nạp entity vào phiên
     * làm việc) — để khoá dòng biểu trước rồi mới nạp phiên bản.
     */
    @Query("select v.template.id from TemplateVersion v where v.id = :id")
    Optional<Long> findTemplateIdById(@Param("id") Long id);

    @Query("select coalesce(max(v.versionNo), 0) from TemplateVersion v where v.template.id = :templateId")
    Integer maxVersionNo(@Param("templateId") Long templateId);

    /** Có bản kế tiếp nào (mọi trạng thái) — điều kiện "bản mới nhất" khi xoá. */
    boolean existsByPreviousVersionId(Long previousVersionId);

    /** Số bản kế tiếp còn sống (không tính bản đã thu hồi) — luật không rẽ nhánh. */
    long countByPreviousVersionIdAndStatusNot(Long previousVersionId, TemplateStatus status);

    /**
     * UC-19: bản đã ban hành có ngày áp dụng ≤ ngày mốc, mới nhất.
     * Hoà ngày (không nên xảy ra — service chặn khi ban hành) thì lấy bản tạo sau.
     */
    Optional<TemplateVersion> findFirstByTemplateIdAndStatusAndEffectiveFromLessThanEqualOrderByEffectiveFromDescIdDesc(
            Long templateId, TemplateStatus status, LocalDate date);

    /** UC-19 luồng 1a: bản đã ban hành sớm nhất, để mượn khi ngày mốc trước mọi bản. */
    Optional<TemplateVersion> findFirstByTemplateIdAndStatusAndEffectiveFromNotNullOrderByEffectiveFromAscIdAsc(
            Long templateId, TemplateStatus status);

    /**
     * Thông tin gọn của mọi phiên bản thuộc các biểu cho trước, không kéo
     * workbook / script: {@code [templateId, versionId, versionNo, status, effectiveFrom]}.
     */
    @Query("select v.template.id, v.id, v.versionNo, v.status, v.effectiveFrom "
            + "from TemplateVersion v where v.template.id in :templateIds")
    List<Object[]> summariesByTemplateIds(@Param("templateIds") Collection<Long> templateIds);
}
