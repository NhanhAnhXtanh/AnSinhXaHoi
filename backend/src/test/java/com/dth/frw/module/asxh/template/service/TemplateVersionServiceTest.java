package com.dth.frw.module.asxh.template.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.domain.asxh.template.Template;
import com.dth.frw.domain.asxh.template.TemplateKind;
import com.dth.frw.domain.asxh.template.TemplateSet;
import com.dth.frw.domain.asxh.template.TemplateStatus;
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
 * Luật vòng đời phiên bản mẫu (UC-13..19): ban hành, phiên bản kế tiếp, khoá ⇄
 * mở khoá, thu hồi LIFO, xoá, chọn phiên bản theo ngày, chuẩn hoá workbook.
 *
 * <p>Chạy trên cơ sở dữ liệu thật như các test khác của base, trong một giao
 * dịch được cuộn lại sau mỗi test. Mỗi test tự tạo bộ mẫu + biểu riêng (tên bộ
 * kèm số ngẫu nhiên) nên không phụ thuộc dữ liệu seed.
 */
@SpringBootTest
@Transactional
class TemplateVersionServiceTest {

    private static final String WORKBOOK =
            "{\"version\":\"19.2.1\",\"sheetCount\":1,\"sheets\":{\"1a\":{\"name\":\"1a\",\"rowCount\":10,\"columnCount\":4}}}";

    private static final LocalDate JAN_2026 = LocalDate.of(2026, 1, 1);
    private static final LocalDate JUL_2026 = LocalDate.of(2026, 7, 1);

    @Autowired
    private TemplateSetService setService;

    @Autowired
    private TemplateService templateService;

    @Autowired
    private TemplateVersionService service;

    @Autowired
    private TemplateVersionRepository repository;

    // ---------------------------------------------------------------- dựng dữ liệu

    private Template newTemplate() {
        TemplateSet set = setService.create(new TemplateSetRequest("Bộ mẫu thử " + System.nanoTime(), null));
        return templateService.create(new TemplateRequest(
                new TemplateSetRef(set.getId()), "1a", "Biểu thử nghiệm", TemplateKind.CHI_TIET, null, JAN_2026));
    }

    private TemplateVersion firstVersion(Template template) {
        return repository.findByTemplateIdOrderByVersionNoAsc(template.getId()).get(0);
    }

    private TemplateVersion design(TemplateVersion version) {
        return service.update(version.getId(), new TemplateVersionPatchRequest(null, WORKBOOK, null));
    }

    /** v1 ban hành từ 01/01/2026, v2 ban hành từ 01/07/2026. */
    private List<TemplateVersion> twoPublished(Template template) {
        TemplateVersion v1 = design(firstVersion(template));
        service.publish(v1.getId(), JAN_2026);
        TemplateVersion v2 = service.nextVersion(template.getId());
        service.publish(v2.getId(), JUL_2026);
        return List.of(v1, v2);
    }

    // ------------------------------------------------------------------- ban hành

    @Test
    @DisplayName("Tạo biểu sinh phiên bản 1 ở trạng thái Nháp")
    void createTemplateMakesDraftV1() {
        TemplateVersion v1 = firstVersion(newTemplate());
        assertEquals(1, v1.getVersionNo());
        assertEquals(TemplateStatus.DRAFT, v1.getStatus());
        assertEquals(JAN_2026, v1.getEffectiveFrom());
    }

    @Test
    @DisplayName("Ban hành: bản chưa thiết kế bị từ chối")
    void publishRequiresDesignedWorkbook() {
        TemplateVersion v1 = firstVersion(newTemplate());
        ConflictException e = assertThrows(ConflictException.class, () -> service.publish(v1.getId(), JAN_2026));
        assertTrue(e.getMessage().contains("chưa được thiết kế"));
    }

    @Test
    @DisplayName("Ban hành: ghi ngày, trạng thái, thời điểm; bản đã ban hành không sửa được nữa")
    void publishMakesImmutable() {
        TemplateVersion v1 = design(firstVersion(newTemplate()));
        TemplateVersion published = service.publish(v1.getId(), JAN_2026);

        assertEquals(TemplateStatus.PUBLISHED, published.getStatus());
        assertEquals(JAN_2026, published.getEffectiveFrom());
        assertNotNull(published.getPublishedAt());
        assertThrows(ConflictException.class,
                () -> service.update(v1.getId(), new TemplateVersionPatchRequest(null, WORKBOOK, List.of(
                        new TemplateScriptPayload(null, null, "Sửa", null, "// sửa", null, null, true)))));
        assertThrows(ConflictException.class, () -> service.publish(v1.getId(), JAN_2026));
    }

    @Test
    @DisplayName("Phiên bản kế tiếp phải áp dụng sau bản nguồn; bản trước tự hết hiệu lực một ngày trước bản sau")
    void successorDateRules() {
        Template template = newTemplate();
        TemplateVersion v1 = design(firstVersion(template));
        service.publish(v1.getId(), JAN_2026);
        TemplateVersion v2 = service.nextVersion(template.getId());

        assertEquals(TemplateStatus.DRAFT, v2.getStatus());
        assertNull(v2.getEffectiveFrom());
        assertEquals(v1.getWorkbookJson(), v2.getWorkbookJson());

        ConflictException early = assertThrows(ConflictException.class, () -> service.publish(v2.getId(), JAN_2026));
        assertTrue(early.getMessage().contains("02/01/2026"));

        service.publish(v2.getId(), JUL_2026);
        assertEquals(LocalDate.of(2026, 6, 30), service.get(v1.getId()).getEffectiveTo());
        assertNull(service.get(v2.getId()).getEffectiveTo());
    }

    @Test
    @DisplayName("Không rẽ nhánh: đang có bản nháp thì không tạo thêm phiên bản kế tiếp")
    void noSecondDraft() {
        Template template = newTemplate();
        TemplateVersion v1 = design(firstVersion(template));
        service.publish(v1.getId(), JAN_2026);
        service.nextVersion(template.getId());
        assertThrows(ConflictException.class, () -> service.nextVersion(template.getId()));
    }

    // ------------------------------------------------------------- khoá / mở khoá

    @Test
    @DisplayName("Khoá chỉ bản đã ban hành mới nhất; bản khoá bị bỏ qua khi chọn theo ngày; mở khoá trả lại như cũ")
    void lockAndUnlock() {
        Template template = newTemplate();
        List<TemplateVersion> chain = twoPublished(template);
        TemplateVersion v1 = chain.get(0);
        TemplateVersion v2 = chain.get(1);

        assertThrows(ConflictException.class, () -> service.lock(v1.getId()));

        service.lock(v2.getId());
        assertEquals(TemplateStatus.LOCKED, service.get(v2.getId()).getStatus());
        assertEquals(v1.getId(), service.resolve(template.getId(), LocalDate.of(2026, 8, 1)).orElseThrow().getId());
        assertNull(service.get(v1.getId()).getEffectiveTo(), "bản còn lại thành bản cuối, không có ngày hết hiệu lực");

        assertThrows(ConflictException.class, () -> service.revoke(v2.getId()), "bản đang khoá không thu hồi được");
        assertThrows(ConflictException.class, () -> service.nextVersion(template.getId()));

        TemplateVersion unlocked = service.unlock(v2.getId());
        assertEquals(TemplateStatus.PUBLISHED, unlocked.getStatus());
        assertEquals(JUL_2026, unlocked.getEffectiveFrom());
        assertNotNull(unlocked.getPublishedAt());
        assertEquals(v2.getId(), service.resolve(template.getId(), LocalDate.of(2026, 8, 1)).orElseThrow().getId());
    }

    // ---------------------------------------------------------------- thu hồi LIFO

    @Test
    @DisplayName("Thu hồi lần lượt từ bản mới nhất; không thu hồi bản đã ban hành cuối cùng")
    void revokeLifo() {
        Template template = newTemplate();
        List<TemplateVersion> chain = twoPublished(template);
        TemplateVersion v1 = chain.get(0);
        TemplateVersion v2 = chain.get(1);

        ConflictException notLatest = assertThrows(ConflictException.class, () -> service.revoke(v1.getId()));
        assertTrue(notLatest.getMessage().contains("mới nhất"));

        TemplateVersion revoked = service.revoke(v2.getId());
        assertEquals(TemplateStatus.REVOKED, revoked.getStatus());
        assertNotNull(revoked.getRevokedAt());
        assertEquals(v1.getId(), service.resolve(template.getId(), LocalDate.of(2026, 8, 1)).orElseThrow().getId());

        ConflictException last = assertThrows(ConflictException.class, () -> service.revoke(v1.getId()));
        assertTrue(last.getMessage().contains("cuối cùng"));
    }

    @Test
    @DisplayName("Thu hồi bị chặn khi chuỗi còn bản nháp khác")
    void revokeBlockedByDraft() {
        Template template = newTemplate();
        List<TemplateVersion> chain = twoPublished(template);
        service.nextVersion(template.getId());
        assertThrows(ConflictException.class, () -> service.revoke(chain.get(1).getId()));
    }

    // ------------------------------------------------------------------------ xoá

    @Test
    @DisplayName("Xoá chỉ bản mới nhất của chuỗi")
    void deleteOnlyLatest() {
        Template template = newTemplate();
        List<TemplateVersion> chain = twoPublished(template);
        TemplateVersion v3 = service.nextVersion(template.getId());

        assertThrows(ConflictException.class, () -> service.delete(chain.get(0).getId()));

        service.delete(v3.getId());
        assertTrue(repository.findById(v3.getId()).isEmpty());
    }

    // ------------------------------------------------------------ chọn theo ngày

    @Test
    @DisplayName("Chọn phiên bản theo ngày: bản đã ban hành mới nhất có ngày áp dụng không sau ngày mốc")
    void resolveByDate() {
        Template template = newTemplate();
        List<TemplateVersion> chain = twoPublished(template);
        Long id = template.getId();

        assertEquals(chain.get(0).getId(), service.resolve(id, LocalDate.of(2026, 3, 15)).orElseThrow().getId());
        assertEquals(chain.get(1).getId(), service.resolve(id, JUL_2026).orElseThrow().getId());
        assertEquals(chain.get(1).getId(), service.resolve(id, LocalDate.of(2027, 1, 1)).orElseThrow().getId());

        // Ngày mốc trước mọi bản: resolve không có, resolveOrEarliest mượn bản sớm nhất (UC-19 1a).
        assertTrue(service.resolve(id, LocalDate.of(2025, 6, 1)).isEmpty());
        assertEquals(chain.get(0).getId(),
                service.resolveOrEarliest(id, LocalDate.of(2025, 6, 1)).orElseThrow().getId());
    }

    @Test
    @DisplayName("Biểu chưa ban hành bản nào thì không chọn được phiên bản (UC-19 1b)")
    void requireApplicableWithoutPublished() {
        Template template = newTemplate();
        assertThrows(ConflictException.class, () -> service.requireApplicable(template.getId(), JUL_2026));
    }

    @Test
    @DisplayName("Bản nháp không bao giờ được chọn theo ngày")
    void draftsAreNeverResolved() {
        Template template = newTemplate();
        design(firstVersion(template));
        assertFalse(service.resolveOrEarliest(template.getId(), JUL_2026).isPresent());
    }

    // -------------------------------------------------------------- workbook

    @Test
    @DisplayName("Lưu workbook: JSON hỏng hoặc không có trang bị từ chối; trang \"Evaluation Version\" bị cắt")
    void workbookNormalisation() {
        TemplateVersion v1 = firstVersion(newTemplate());
        Long id = v1.getId();

        assertThrows(ConflictException.class,
                () -> service.update(id, new TemplateVersionPatchRequest(null, "không phải JSON", null)));
        assertThrows(ConflictException.class,
                () -> service.update(id, new TemplateVersionPatchRequest(null, "{}", null)));

        String withWatermark = "{\"version\":\"19.2.1\",\"sheetCount\":2,\"sheets\":{"
                + "\"1a\":{\"name\":\"1a\"},"
                + "\"Evaluation Version\":{\"name\":\"Evaluation Version\"}}}";
        TemplateVersion saved = service.update(id, new TemplateVersionPatchRequest(null, withWatermark, null));
        assertFalse(saved.getWorkbookJson().contains("Evaluation Version"));
        assertEquals(1, service.sheetCount(saved.getWorkbookJson()));
    }

    @Test
    @DisplayName("Ban hành: workbook nhiều trang bị từ chối (mỗi phiên bản đúng một biểu)")
    void publishRejectsMultiSheet() {
        TemplateVersion v1 = firstVersion(newTemplate());
        String twoSheets = "{\"sheetCount\":2,\"sheets\":{\"1a\":{\"name\":\"1a\"},\"Trang 2\":{\"name\":\"Trang 2\"}}}";
        service.update(v1.getId(), new TemplateVersionPatchRequest(null, twoSheets, null));
        assertThrows(ConflictException.class, () -> service.publish(v1.getId(), JAN_2026));
    }
}
