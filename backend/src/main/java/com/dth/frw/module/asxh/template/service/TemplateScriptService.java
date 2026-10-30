package com.dth.frw.module.asxh.template.service;

import com.dth.frw.domain.asxh.template.TemplateScript;
import com.dth.frw.domain.asxh.template.TemplateVersion;
import com.dth.frw.module.asxh.script.ServerScriptRunner;
import com.dth.frw.module.asxh.template.api.dto.TemplateScriptPayload;
import com.dth.frw.module.asxh.template.migration.SplitTemplateScriptsChange;
import com.dth.frw.module.asxh.template.repo.TemplateScriptRepository;
import com.dth.frw.module.asxh.template.repo.TemplateVersionRepository;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.security.CurrentUser;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Kịch bản (script) theo phiên bản mẫu — port {@code TemplateScriptService} của bản Jmix.
 *
 * <p>Designer lưu theo kiểu THAY CẢ DANH SÁCH (REPLACE-ALL): người soạn sửa nhiều kịch bản rồi
 * bấm Lưu một lần; kịch bản không còn trong danh sách gửi lên bị xoá, thứ tự chạy là thứ tự
 * trong danh sách. Chỉ phiên bản Nháp / Đang thử nghiệm sửa được.
 *
 * <p>Ngoại lệ của bản Jmix giữ nguyên: kịch bản TỔNG HỢP (mã khai {@code getSummaryData} — Sở
 * trích số đã sửa trên bảng tổng hợp) thay riêng được cả khi phiên bản đã ban hành, vì nó không
 * chạy ở nhập liệu / duyệt; chỉ chặn phiên bản đã thu hồi.
 *
 * <p>Mọi thao tác ghi khoá dòng biểu cha trước ({@link TemplateService#lock}) như các thao tác
 * khác trên phiên bản, để không lọt qua lúc phiên bản vừa bị ban hành / khoá.
 *
 * <p>Chưa làm (việc sau): tự đăng ký chỉ tiêu (UC-05, {@code TemplateIndicatorRegistrationService}
 * của bản Jmix) khi lưu kịch bản.
 */
@Service
@Transactional(readOnly = true)
public class TemplateScriptService {

    // Giữ khớp độ dài cột của asxh_template_scripts.
    private static final int NAME_MAX_LENGTH = 255;
    private static final int DESCRIPTION_MAX_LENGTH = 500;
    private static final int DECLARED_HOOKS_MAX_LENGTH = 500;
    private static final int SHEET_CODE_MAX_LENGTH = 32;
    /** Như giới hạn cũ của cột script_text gửi qua PATCH. */
    private static final int CODE_MAX_LENGTH = 2_000_000;

    private static final Pattern BLOCK_COMMENT = Pattern.compile("/\\*.*?\\*/", Pattern.DOTALL);
    private static final Pattern LINE_COMMENT = Pattern.compile("//[^\\n]*");
    private static final Pattern SUMMARY_HOOK = Pattern.compile("\\bgetSummaryData\\s*[(:]");

    private final TemplateScriptRepository repository;
    private final TemplateVersionRepository versionRepository;
    private final TemplateService templateService;
    private final ObjectMapper mapper;

    public TemplateScriptService(TemplateScriptRepository repository,
                                 TemplateVersionRepository versionRepository,
                                 TemplateService templateService,
                                 ObjectMapper mapper) {
        this.repository = repository;
        this.versionRepository = versionRepository;
        this.templateService = templateService;
        this.mapper = mapper;
    }

    // ------------------------------------------------------------------ đọc

    /** Toàn bộ kịch bản của phiên bản (kể cả đang tắt) — màn soạn trong Designer. */
    public List<TemplateScript> list(Long versionId) {
        requireVersion(versionId);
        return repository.findByTemplateVersionIdOrderByDisplayOrderAscIdAsc(versionId);
    }

    /**
     * Kịch bản sẽ CHẠY cho phiên bản: đang bật, áp mọi biểu hoặc đúng biểu của phiên bản, theo thứ
     * tự chạy. Một bộ cho mọi màn — mỗi màn chỉ gọi hook của nó.
     */
    public List<TemplateScript> runtimeScripts(TemplateVersion version) {
        if (version == null || version.getId() == null) {
            return List.of();
        }
        return repository.findRuntime(version.getId(), version.getTemplate().getCode());
    }

    /** Như {@link #runtimeScripts} ở dạng máy chạy phía máy chủ nhận. */
    public List<ServerScriptRunner.ScriptSource> runtimeSources(TemplateVersion version) {
        return runtimeScripts(version).stream()
                .map(script -> new ServerScriptRunner.ScriptSource(script.getName(), script.getCode()))
                .toList();
    }

    /**
     * Kịch bản chạy được của phiên bản, gửi cho trình duyệt: mảng JSON
     * {@code [{ id, name, sheetCode: null, code, displayOrder, enabled: true }]} — đúng dạng
     * {@code parseScriptText} phía trình duyệt đọc, nên các màn nhập liệu / duyệt / tổng hợp vẫn
     * nhận trường {@code scriptText} như trước mà mỗi kịch bản được biên dịch riêng. Đã lọc theo
     * biểu ở đây nên {@code sheetCode} để trống. Không có kịch bản nào → chuỗi rỗng.
     */
    public String runtimeScriptText(TemplateVersion version) {
        List<TemplateScript> scripts = runtimeScripts(version);
        if (scripts.isEmpty()) {
            return "";
        }
        List<Map<String, Object>> records = new ArrayList<>();
        for (TemplateScript script : scripts) {
            Map<String, Object> record = new LinkedHashMap<>();
            record.put("id", String.valueOf(script.getId()));
            record.put("name", script.getName());
            record.put("sheetCode", null);
            record.put("code", script.getCode());
            record.put("displayOrder", script.getDisplayOrder());
            record.put("enabled", true);
            records.add(record);
        }
        return mapper.writeValueAsString(records);
    }

    /** Phiên bản có kịch bản đang chạy nào khai {@code getSummaryData} (Sở sửa số được — UC-55 2a). */
    public boolean hasSummaryHook(TemplateVersion version) {
        return runtimeScripts(version).stream().anyMatch(script -> isSummaryScript(script.getCode()));
    }

    /**
     * Kịch bản là "kịch bản tổng hợp" khi mã nguồn (bỏ chú thích) khai {@code getSummaryData}
     * — dạng {@code getSummaryData(ctx) {…}} hoặc {@code getSummaryData: …}. Trường
     * {@code declaredHooks} chỉ để hiển thị, không phải sự thật.
     */
    public static boolean isSummaryScript(String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        String stripped = LINE_COMMENT.matcher(BLOCK_COMMENT.matcher(code).replaceAll(" ")).replaceAll(" ");
        return SUMMARY_HOOK.matcher(stripped).find();
    }

    // ------------------------------------------------------------------ ghi

    /** Thay TOÀN BỘ danh sách kịch bản của phiên bản Nháp / Đang thử nghiệm. */
    @Transactional
    public List<TemplateScript> replaceAll(Long versionId, List<TemplateScriptPayload> payloads) {
        TemplateVersion version = lockedVersion(versionId);
        if (!version.getStatus().editable()) {
            throw new ConflictException(
                    "Phiên bản này đã ban hành, đã khoá hoặc đã thu hồi nên không sửa được kịch bản — "
                            + "hãy tạo phiên bản kế tiếp để thay đổi.");
        }
        return replace(version, payloads);
    }

    /**
     * Phần việc của {@link #replaceAll} khi người gọi ĐÃ khoá biểu và kiểm trạng thái — lưu
     * Designer (bảng tính + kịch bản trong một giao dịch, như nút Lưu của bản Jmix).
     */
    @Transactional
    public List<TemplateScript> replace(TemplateVersion version, List<TemplateScriptPayload> payloads) {
        List<TemplateScriptPayload> safe = payloads == null ? List.of() : payloads;
        validate(version, safe);
        Map<Long, TemplateScript> existing = byId(repository.findByTemplateVersionIdOrderByDisplayOrderAscIdAsc(
                version.getId()));
        List<TemplateScript> toSave = new ArrayList<>();
        int order = 0;
        for (TemplateScriptPayload payload : safe) {
            TemplateScript script = payload.id() == null ? null : existing.remove(payload.id());
            if (script == null) {
                // id lạ (đã bị xoá ở phiên khác hoặc thuộc phiên bản khác) → tạo mới, không ghi đè.
                script = newScript(version);
            }
            // Thứ tự chạy = thứ tự trong danh sách gửi lên — nguồn sự thật duy nhất.
            apply(script, payload, order++);
            toSave.add(script);
        }
        repository.deleteAll(existing.values());
        repository.flush();
        repository.saveAll(toSave);
        return repository.findByTemplateVersionIdOrderByDisplayOrderAscIdAsc(version.getId());
    }

    /**
     * Chép mọi kịch bản (kể cả đang tắt) của phiên bản nguồn sang phiên bản đích — "Tạo phiên bản
     * kế tiếp" mang theo kịch bản, không phải dán lại (BR-14.3). Người gọi đã khoá biểu.
     */
    @Transactional
    public List<TemplateScript> copyScripts(TemplateVersion source, TemplateVersion target) {
        List<TemplateScript> copies = new ArrayList<>();
        for (TemplateScript script : repository.findByTemplateVersionIdOrderByDisplayOrderAscIdAsc(source.getId())) {
            TemplateScript copy = newScript(target);
            copy.setSheetCode(script.getSheetCode());
            copy.setName(script.getName());
            copy.setDescription(script.getDescription());
            copy.setCode(script.getCode());
            copy.setDeclaredHooks(script.getDeclaredHooks());
            copy.setDisplayOrder(script.getDisplayOrder());
            copy.setEnabled(script.isEnabled());
            copy.setScriptHash(script.getScriptHash());
            copies.add(copy);
        }
        return repository.saveAll(copies);
    }

    // ------------------------------------------------------------------ phụ

    private TemplateVersion lockedVersion(Long versionId) {
        Long templateId = versionRepository.findTemplateIdById(versionId)
                .orElseThrow(() -> new TemplateNotFoundException("phiên bản mẫu", versionId));
        templateService.lock(templateId);
        return versionRepository.findById(versionId)
                .orElseThrow(() -> new TemplateNotFoundException("phiên bản mẫu", versionId));
    }

    private void requireVersion(Long versionId) {
        if (versionId == null || !versionRepository.existsById(versionId)) {
            throw new TemplateNotFoundException("phiên bản mẫu", versionId);
        }
    }

    private static TemplateScript newScript(TemplateVersion version) {
        TemplateScript script = new TemplateScript(version);
        script.setCreatedBy(CurrentUser.username().orElse(null));
        return script;
    }

    private static Map<Long, TemplateScript> byId(List<TemplateScript> scripts) {
        Map<Long, TemplateScript> map = new LinkedHashMap<>();
        scripts.forEach(script -> map.put(script.getId(), script));
        return map;
    }

    private static void validate(TemplateVersion version, List<TemplateScriptPayload> payloads) {
        String ownCode = version.getTemplate().getCode();
        for (TemplateScriptPayload payload : payloads) {
            if (payload == null || payload.name() == null || payload.name().isBlank()) {
                throw new IllegalArgumentException("Tên kịch bản không được để trống.");
            }
            requireMaxLength(payload.name(), NAME_MAX_LENGTH, "Tên kịch bản");
            requireMaxLength(payload.description(), DESCRIPTION_MAX_LENGTH, "Mô tả kịch bản");
            requireMaxLength(payload.declaredHooks(), DECLARED_HOOKS_MAX_LENGTH, "Danh sách hàm của kịch bản");
            requireMaxLength(payload.sheetCode(), SHEET_CODE_MAX_LENGTH, "Phạm vi biểu của kịch bản");
            requireMaxLength(payload.code(), CODE_MAX_LENGTH, "Mã kịch bản \"" + payload.name() + "\"");
            String sheetCode = blankToNull(payload.sheetCode());
            // Một phiên bản đúng một biểu: phạm vi chỉ có "mọi biểu" hoặc chính biểu này.
            if (sheetCode != null && !sheetCode.equals(ownCode)) {
                throw new IllegalArgumentException("Kịch bản \"" + payload.name()
                        + "\" gắn với một biểu không thuộc phiên bản này.");
            }
        }
    }

    private static void apply(TemplateScript script, TemplateScriptPayload payload, int order) {
        script.setSheetCode(blankToNull(payload.sheetCode()));
        script.setName(payload.name().strip());
        script.setDescription(blankToNull(payload.description()));
        script.setCode(Objects.requireNonNullElse(payload.code(), ""));
        script.setDeclaredHooks(blankToNull(payload.declaredHooks()));
        script.setDisplayOrder(order);
        script.setEnabled(!Boolean.FALSE.equals(payload.enabled()));
        script.setScriptHash(SplitTemplateScriptsChange.sha256(script.getCode()));
        if (script.getId() != null) {
            script.setUpdatedBy(CurrentUser.username().orElse(null));
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static void requireMaxLength(String value, int max, String label) {
        if (value != null && value.length() > max) {
            throw new IllegalArgumentException(label + " dài quá " + max + " ký tự (hiện " + value.length() + ").");
        }
    }
}
