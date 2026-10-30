package com.dth.frw.module.asxh.template.repo;

import com.dth.frw.domain.asxh.template.TemplateScript;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TemplateScriptRepository extends JpaRepository<TemplateScript, Long> {

    /** Mọi kịch bản của phiên bản (kể cả đang tắt), theo thứ tự chạy — màn soạn trong Designer. */
    List<TemplateScript> findByTemplateVersionIdOrderByDisplayOrderAscIdAsc(Long templateVersionId);

    /**
     * Kịch bản sẽ CHẠY cho một biểu: đang bật và (áp mọi biểu hoặc đúng biểu đó), theo thứ tự chạy
     * — port {@code TemplateScriptService.listForRuntime} của bản Jmix.
     */
    @Query("select s from TemplateScript s where s.templateVersion.id = :versionId and s.enabled = true "
            + "and (s.sheetCode is null or s.sheetCode = :sheetCode) order by s.displayOrder asc, s.id asc")
    List<TemplateScript> findRuntime(@Param("versionId") Long versionId, @Param("sheetCode") String sheetCode);
}
