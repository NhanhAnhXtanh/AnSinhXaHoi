package com.dth.frw.module.asxh.template.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateScript;
import com.dth.frw.domain.asxh.template.TemplateSet;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.script.ServerScriptRunnerMultiBlockTest;
import com.dth.frw.module.asxh.template.api.dto.TemplateRequest;
import com.dth.frw.module.asxh.template.api.dto.TemplateSetRef;
import com.dth.frw.module.asxh.template.api.dto.TemplateSetRequest;
import com.dth.frw.module.asxh.template.repo.TemplateScriptRepository;
import com.dth.frw.module.asxh.template.repo.TemplateVersionRepository;
import com.dth.frw.module.asxh.template.service.TemplateService;
import com.dth.frw.module.asxh.template.service.TemplateSetService;
import jakarta.persistence.EntityManager;
import java.sql.Connection;
import java.time.LocalDate;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.transaction.annotation.Transactional;

/**
 * Changeset 171 trên CSDL thật: phiên bản có {@code script_text} gộp mà chưa có kịch bản thì được
 * tách; chạy lại không nhân đôi; {@code script_text} giữ nguyên. Chạy trong giao dịch của test
 * (cùng kết nối) nên cuộn lại sau test.
 */
@SpringBootTest
@Transactional
class SplitTemplateScriptsChangeTest {

    @Autowired
    private TemplateSetService setService;

    @Autowired
    private TemplateService templateService;

    @Autowired
    private TemplateVersionRepository versionRepository;

    @Autowired
    private TemplateScriptRepository scriptRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private DataSource dataSource;

    @SuppressWarnings("deprecation")
    private TemplateVersion versionWithLegacyText(String text) {
        TemplateSet set = setService.create(new TemplateSetRequest("Bộ mẫu tách script " + System.nanoTime(), null));
        Template template = templateService.create(new TemplateRequest(new TemplateSetRef(set.getId()), "1a",
                "Biểu thử tách", TemplateKind.CHI_TIET, null, LocalDate.of(2026, 1, 1)));
        TemplateVersion version = versionRepository.findByTemplateIdOrderByVersionNoAsc(template.getId()).get(0);
        version.setScriptText(text);
        versionRepository.saveAndFlush(version);
        return version;
    }

    @Test
    @DisplayName("Tách khối Jmix thành từng kịch bản; chạy lại không thêm gì; cột cũ giữ nguyên")
    @SuppressWarnings("deprecation")
    void splitsAndIsIdempotent() throws Exception {
        TemplateVersion marked = versionWithLegacyText(ServerScriptRunnerMultiBlockTest.MIGRATED);
        TemplateVersion plain = versionWithLegacyText("return defineScript({ onLoad(ctx) {} });");
        TemplateVersion empty = versionWithLegacyText("   ");

        Connection connection = DataSourceUtils.getConnection(dataSource);
        SplitTemplateScriptsChange.Result first = SplitTemplateScriptsChange.migrate(connection);
        entityManager.clear();

        List<TemplateScript> scripts = scriptRepository.findByTemplateVersionIdOrderByDisplayOrderAscIdAsc(marked.getId());
        assertEquals(List.of("Lock cell", "Ledger", "Validate"), scripts.stream().map(TemplateScript::getName).toList());
        assertEquals(List.of("onLoad", "getInputData", "validate,getSummaryData"),
                scripts.stream().map(TemplateScript::getDeclaredHooks).toList());
        assertTrue(scripts.stream().allMatch(TemplateScript::isEnabled));
        assertTrue(scripts.stream().allMatch(s -> s.getCode().startsWith("const SHEET")));
        assertTrue(scripts.stream().allMatch(s -> SplitTemplateScriptsChange.CREATED_BY.equals(s.getCreatedBy())));
        assertEquals(SplitTemplateScriptsChange.sha256(scripts.get(0).getCode()), scripts.get(0).getScriptHash());

        List<TemplateScript> whole = scriptRepository.findByTemplateVersionIdOrderByDisplayOrderAscIdAsc(plain.getId());
        assertEquals(1, whole.size());
        assertEquals(ScriptTextSplitter.WHOLE_SCRIPT_NAME, whole.getFirst().getName());

        assertTrue(scriptRepository.findByTemplateVersionIdOrderByDisplayOrderAscIdAsc(empty.getId()).isEmpty());
        assertTrue(first.versions() >= 2 && first.scripts() >= 4, first.toString());

        SplitTemplateScriptsChange.Result second = SplitTemplateScriptsChange.migrate(connection);
        assertEquals(0, second.scripts(), "chạy lại không nhân đôi");
        assertEquals(3, scriptRepository.findByTemplateVersionIdOrderByDisplayOrderAscIdAsc(marked.getId()).size());
        assertEquals(ServerScriptRunnerMultiBlockTest.MIGRATED,
                versionRepository.findById(marked.getId()).orElseThrow().getScriptText(), "cột cũ giữ nguyên");
    }
}
