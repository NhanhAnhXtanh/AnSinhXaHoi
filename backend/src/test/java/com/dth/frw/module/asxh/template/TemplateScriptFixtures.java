package com.dth.frw.module.asxh.template;

import com.dth.frw.domain.asxh.template.TemplateScript;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import jakarta.persistence.EntityManager;

/**
 * Dựng kịch bản cho phiên bản mẫu trong test chạy trên CSDL thật (giao dịch cuộn lại sau test).
 */
public final class TemplateScriptFixtures {

    private TemplateScriptFixtures() {
    }

    /** Phiên bản chỉ còn đúng MỘT kịch bản đang bật — thay mọi kịch bản sẵn có (kể cả dữ liệu seed). */
    public static TemplateScript useOnly(EntityManager entityManager, TemplateVersion version, String name,
                                         String code) {
        entityManager.createQuery("delete from TemplateScript s where s.templateVersion.id = :id")
                .setParameter("id", version.getId())
                .executeUpdate();
        TemplateScript script = new TemplateScript(version);
        script.setName(name);
        script.setCode(code);
        script.setDisplayOrder(0);
        script.setEnabled(true);
        entityManager.persist(script);
        return script;
    }
}
