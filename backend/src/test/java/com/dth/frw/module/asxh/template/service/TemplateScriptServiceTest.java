package com.dth.frw.module.asxh.template.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateScript;
import com.dth.frw.domain.asxh.template.TemplateSet;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.template.api.dto.TemplateRequest;
import com.dth.frw.module.asxh.template.api.dto.TemplateScriptPayload;
import com.dth.frw.module.asxh.template.api.dto.TemplateSetRef;
import com.dth.frw.module.asxh.template.api.dto.TemplateSetRequest;
import com.dth.frw.module.asxh.template.api.dto.TemplateVersionPatchRequest;
import com.dth.frw.module.asxh.template.repo.TemplateVersionRepository;
import com.dth.frw.shared.exception.ConflictException;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kịch bản theo phiên bản mẫu (port {@code TemplateScriptService} của bản Jmix): lưu thay cả danh
 * sách, chặn sửa sau ban hành trừ kịch bản tổng hợp, nhân bản mang kịch bản, chọn kịch bản chạy.
 * CSDL thật, giao dịch cuộn lại sau mỗi test.
 */
@SpringBootTest
@Transactional
class TemplateScriptServiceTest {

    private static final String WORKBOOK =
            "{\"version\":\"19.2.1\",\"sheetCount\":1,\"sheets\":{\"1a\":{\"name\":\"1a\",\"rowCount\":10,\"columnCount\":4}}}";
    private static final LocalDate JAN_2026 = LocalDate.of(2026, 1, 1);

    private static final String UNIT_CODE = "return defineScript({ validate(ctx) {} });";
    private static final String SUMMARY_CODE = "return defineScript({ getSummaryData(ctx) { return []; } });";

    @Autowired
    private TemplateSetService setService;

    @Autowired
    private TemplateService templateService;

    @Autowired
    private TemplateVersionService versionService;

    @Autowired
    private TemplateScriptService service;

    @Autowired
    private TemplateVersionRepository versionRepository;

    private TemplateVersion draft() {
        TemplateSet set = setService.create(new TemplateSetRequest("Bộ mẫu kịch bản " + System.nanoTime(), null));
        Template template = templateService.create(new TemplateRequest(
                new TemplateSetRef(set.getId()), "1a", "Biểu thử kịch bản", TemplateKind.CHI_TIET, null, JAN_2026));
        TemplateVersion v1 = versionRepository.findByTemplateIdOrderByVersionNoAsc(template.getId()).get(0);
        return versionService.update(v1.getId(), new TemplateVersionPatchRequest(null, WORKBOOK, null));
    }

    private static TemplateScriptPayload payload(Long id, String name, String code) {
        return new TemplateScriptPayload(id, null, name, null, code, null, null, true);
    }

    private static List<String> names(List<TemplateScript> scripts) {
        return scripts.stream().map(TemplateScript::getName).toList();
    }

    @Test
    @DisplayName("Lưu thay cả danh sách: thêm, sửa giữ id, xoá cái không gửi, thứ tự chạy = thứ tự gửi lên")
    void replaceAllOnDraft() {
        TemplateVersion version = draft();
        List<TemplateScript> first = service.replaceAll(version.getId(), List.of(
                payload(null, "Khoá ô", UNIT_CODE),
                payload(null, "Kiểm tra", UNIT_CODE),
                payload(null, "Bỏ đi", UNIT_CODE)));
        assertEquals(List.of("Khoá ô", "Kiểm tra", "Bỏ đi"), names(first));
        assertEquals(List.of(0, 1, 2), first.stream().map(TemplateScript::getDisplayOrder).toList());
        assertEquals(64, first.getFirst().getScriptHash().length());

        Long lockId = first.get(0).getId();
        Long checkId = first.get(1).getId();
        List<TemplateScript> second = service.replaceAll(version.getId(), List.of(
                new TemplateScriptPayload(checkId, version.getTemplate().getCode(), "Kiểm tra (sửa)", "mô tả",
                        UNIT_CODE, "validate", 99, false),
                payload(lockId, "Khoá ô", UNIT_CODE)));

        assertEquals(List.of("Kiểm tra (sửa)", "Khoá ô"), names(second));
        assertEquals(checkId, second.get(0).getId(), "sửa tại chỗ, giữ id");
        assertEquals(0, second.get(0).getDisplayOrder(), "bỏ qua displayOrder gửi lên, theo thứ tự danh sách");
        assertFalse(second.get(0).isEnabled());
        assertEquals(version.getTemplate().getCode(), second.get(0).getSheetCode());
        assertEquals("mô tả", second.get(0).getDescription());

        // Chỉ kịch bản đang bật được chạy.
        assertEquals(List.of("Khoá ô"), names(service.runtimeScripts(version)));
    }

    @Test
    @DisplayName("Lưu kiểm tra dữ liệu: tên trống, phạm vi biểu khác → 400 (IllegalArgumentException)")
    void validatesPayload() {
        TemplateVersion version = draft();
        assertThrows(IllegalArgumentException.class,
                () -> service.replaceAll(version.getId(), List.of(payload(null, " ", UNIT_CODE))));
        assertThrows(IllegalArgumentException.class, () -> service.replaceAll(version.getId(), List.of(
                new TemplateScriptPayload(null, "BM-999999", "Biểu khác", null, UNIT_CODE, null, null, true))));
    }

    @Test
    @DisplayName("Bản đã ban hành: không lưu thay cả danh sách được (409); kịch bản tổng hợp thì thay riêng được")
    void publishedOnlySummaryScripts() {
        TemplateVersion version = draft();
        List<TemplateScript> saved = service.replaceAll(version.getId(), List.of(
                payload(null, "Đơn vị", UNIT_CODE),
                payload(null, "Sổ cái Sở", SUMMARY_CODE)));
        versionService.publish(version.getId(), JAN_2026);

        assertThrows(ConflictException.class,
                () -> service.replaceAll(version.getId(), List.of(payload(null, "x", UNIT_CODE))));
        assertThrows(ConflictException.class, () -> versionService.update(version.getId(),
                new TemplateVersionPatchRequest(null, null, List.of())));

        // Gửi kèm kịch bản không khai getSummaryData → 400, không đổi gì.
        assertThrows(IllegalArgumentException.class, () -> service.replaceSummaryScripts(version.getId(),
                List.of(payload(null, "Lén sửa đơn vị", UNIT_CODE))));
        // id trỏ vào kịch bản đơn vị → 400.
        Long unitId = saved.get(0).getId();
        assertThrows(IllegalArgumentException.class, () -> service.replaceSummaryScripts(version.getId(),
                List.of(payload(unitId, "Đơn vị", SUMMARY_CODE))));

        Long summaryId = saved.get(1).getId();
        List<TemplateScript> after = service.replaceSummaryScripts(version.getId(), List.of(
                payload(summaryId, "Sổ cái Sở (sửa)", SUMMARY_CODE + "\n// sửa"),
                payload(null, "Sổ cái Sở thêm", SUMMARY_CODE)));

        assertEquals(List.of("Đơn vị", "Sổ cái Sở (sửa)", "Sổ cái Sở thêm"), names(after));
        assertEquals(unitId, after.get(0).getId(), "kịch bản đơn vị giữ nguyên");
        assertEquals(UNIT_CODE, after.get(0).getCode());
        assertEquals(summaryId, after.get(1).getId());
        assertTrue(after.get(1).getDisplayOrder() > after.get(0).getDisplayOrder(), "tổng hợp xếp sau đơn vị");
        assertTrue(service.hasSummaryHook(version));

        // Gửi danh sách rỗng: xoá hết kịch bản tổng hợp, kịch bản đơn vị vẫn còn.
        assertEquals(List.of("Đơn vị"), names(service.replaceSummaryScripts(version.getId(), List.of())));
        assertFalse(service.hasSummaryHook(version));
    }

    @Test
    @DisplayName("Bản đã thu hồi: không sửa kể cả kịch bản tổng hợp")
    void revokedIsFrozen() {
        TemplateVersion version = draft();
        versionService.startTesting(version.getId());
        versionService.revoke(version.getId());
        assertThrows(ConflictException.class, () -> service.replaceSummaryScripts(version.getId(),
                List.of(payload(null, "Sổ cái Sở", SUMMARY_CODE))));
    }

    @Test
    @DisplayName("Lưu Designer (PATCH): bảng tính + danh sách kịch bản trong một lần; scripts null = giữ nguyên")
    void patchSavesScriptsWithWorkbook() {
        TemplateVersion version = draft();
        versionService.update(version.getId(), new TemplateVersionPatchRequest(null, WORKBOOK,
                List.of(payload(null, "A", UNIT_CODE), payload(null, "B", SUMMARY_CODE))));
        assertEquals(List.of("A", "B"), names(service.list(version.getId())));

        versionService.update(version.getId(), new TemplateVersionPatchRequest(null, WORKBOOK, null));
        assertEquals(List.of("A", "B"), names(service.list(version.getId())));

        versionService.update(version.getId(), new TemplateVersionPatchRequest(null, null, List.of()));
        assertTrue(service.list(version.getId()).isEmpty());
    }

    @Test
    @DisplayName("Tạo phiên bản kế tiếp mang theo mọi kịch bản (kể cả đang tắt), là bản ghi mới")
    void nextVersionCopiesScripts() {
        TemplateVersion v1 = draft();
        service.replaceAll(v1.getId(), List.of(
                payload(null, "Một", UNIT_CODE),
                new TemplateScriptPayload(null, null, "Hai (tắt)", "ghi chú", SUMMARY_CODE, "getSummaryData", null, false)));
        versionService.publish(v1.getId(), JAN_2026);

        TemplateVersion v2 = versionService.nextVersion(v1.getTemplate().getId());
        List<TemplateScript> source = service.list(v1.getId());
        List<TemplateScript> copied = service.list(v2.getId());

        assertEquals(names(source), names(copied));
        for (int i = 0; i < source.size(); i++) {
            assertNotEquals(source.get(i).getId(), copied.get(i).getId());
            assertEquals(source.get(i).getCode(), copied.get(i).getCode());
            assertEquals(source.get(i).isEnabled(), copied.get(i).isEnabled());
            assertEquals(source.get(i).getDescription(), copied.get(i).getDescription());
            assertEquals(source.get(i).getScriptHash(), copied.get(i).getScriptHash());
        }
        // Sửa bản mới không đụng bản cũ.
        service.replaceAll(v2.getId(), List.of());
        assertEquals(2, service.list(v1.getId()).size());
    }

    @Test
    @DisplayName("Kịch bản gửi trình duyệt: mảng JSON các kịch bản đang bật theo thứ tự; không có → chuỗi rỗng")
    void runtimeScriptText() {
        TemplateVersion version = draft();
        assertEquals("", service.runtimeScriptText(version));
        service.replaceAll(version.getId(), List.of(
                payload(null, "Một", UNIT_CODE),
                new TemplateScriptPayload(null, null, "Tắt", null, SUMMARY_CODE, null, null, false)));
        String json = service.runtimeScriptText(version);
        assertTrue(json.startsWith("["), json);
        assertTrue(json.contains("\"name\":\"Một\""), json);
        assertFalse(json.contains("Tắt"), json);
    }
}
