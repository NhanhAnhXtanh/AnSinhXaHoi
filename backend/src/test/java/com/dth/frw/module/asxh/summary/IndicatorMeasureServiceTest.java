package com.dth.frw.module.asxh.summary;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.domain.asxh.dept.IndicatorMeasure;
import com.dth.frw.domain.asxh.dept.MeasureKind;
import com.dth.frw.module.asxh.summary.api.IndicatorMeasureController;
import com.dth.frw.module.asxh.summary.api.dto.IndicatorMeasureRequest;
import com.dth.frw.module.asxh.summary.api.dto.IndicatorMeasureResponse;
import com.dth.frw.module.asxh.summary.repo.IndicatorMeasureRepository;
import com.dth.frw.module.asxh.summary.security.IndicatorMeasurePermissions;
import com.dth.frw.module.asxh.summary.service.IndicatorMeasureService;
import com.dth.frw.module.asxh.summary.service.IndicatorMeasureService.IndicatorItem;
import com.dth.frw.module.asxh.summary.service.MeasureKindService;
import com.dth.frw.shared.security.JwtService;
import com.dth.frw.shared.web.ListParams;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;

/**
 * Màn "Bản chất chỉ tiêu": danh mục = mã đã có số liệu ∪ mã đã khai; khai / bỏ khai đổi đúng bảng
 * {@code asxh_indicator_measures} mà tổng hợp nhiều kỳ đọc ({@link MeasureKindService}); chỉ quyền ghi mới
 * khai được.
 */
@SpringBootTest
@Transactional
class IndicatorMeasureServiceTest {

    private static final String CODE = "KIEMTHU.BAN_CHAT.A";
    private static final String OTHER = "KIEMTHU.BAN_CHAT.B";

    @Autowired
    private IndicatorMeasureService service;

    @Autowired
    private IndicatorMeasureController controller;

    @Autowired
    private IndicatorMeasureRepository repository;

    @Autowired
    private MeasureKindService measureKinds;

    @BeforeEach
    void seed() {
        repository.save(new IndicatorMeasure(CODE, MeasureKind.LUOT));
        repository.save(new IndicatorMeasure(OTHER, MeasureKind.TIEN));
        repository.flush();
    }

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    private static ListParams params(String... pairs) {
        LinkedMultiValueMap<String, String> raw = new LinkedMultiValueMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            raw.add(pairs[i], pairs[i + 1]);
        }
        raw.add("_start", "0");
        raw.add("_end", "1000");
        return new ListParams(raw);
    }

    private static void signInWith(String... authorities) {
        Jwt jwt = Jwt.withTokenValue("kiem-thu").header("alg", "none").subject("0")
                .claim(JwtService.CLAIM_USERNAME, "kiem-thu").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()));
    }

    @Test
    @DisplayName("Danh mục có cả mã đã khai mà chưa có số liệu; lọc theo bản chất và từ khoá")
    void listsDeclaredCodesAndFilters() {
        List<IndicatorItem> luot = service.list(params("measureKind", "LUOT", "q", "kiemthu")).rows();
        assertEquals(List.of(CODE), luot.stream().map(IndicatorItem::indicatorCode).toList());
        assertEquals(0, luot.getFirst().entryCount());
        assertTrue(luot.getFirst().sheets().isEmpty());

        List<IndicatorItem> unset = service.list(params("measureKind", IndicatorMeasureService.UNSET)).rows();
        assertTrue(unset.stream().noneMatch(item -> item.indicatorCode().startsWith("KIEMTHU.")));
    }

    @Test
    @DisplayName("Khai nhiều mã một lần, giữ ghi chú khi không gửi, bỏ khai thì về mặc định")
    void declareAndReset() {
        service.declare(List.of(CODE, OTHER), "DON_GIA", "Mức hỗ trợ theo nghị quyết");
        assertEquals(Map.of(CODE, MeasureKind.DON_GIA, OTHER, MeasureKind.DON_GIA),
                measureKinds.kindsOf(List.of(CODE, OTHER)));

        List<IndicatorItem> kept = service.declare(List.of(CODE), "THOI_GIAN", null);
        assertEquals("Mức hỗ trợ theo nghị quyết", kept.getFirst().note());
        assertEquals(MeasureKind.THOI_GIAN, kept.getFirst().measureKind());

        service.declare(List.of(OTHER), null, null);
        assertEquals(Map.of(CODE, MeasureKind.THOI_GIAN), measureKinds.kindsOf(List.of(CODE, OTHER)));
        assertTrue(repository.findByIndicatorCodeIn(List.of(OTHER)).isEmpty());
    }

    @Test
    @DisplayName("Mã ngoài danh mục hoặc bản chất lạ bị từ chối bằng câu tiếng Việt")
    void rejectsUnknown() {
        IllegalArgumentException unknownCode = assertThrows(IllegalArgumentException.class,
                () -> service.declare(List.of("KHONG.CO.MA.NAY"), "LUOT", null));
        assertTrue(unknownCode.getMessage().contains("Không tìm thấy chỉ tiêu"));
        assertThrows(IllegalArgumentException.class, () -> service.declare(List.of(CODE), "SAI", null));
        assertThrows(IllegalArgumentException.class, () -> service.declare(List.of(" "), "LUOT", null));
    }

    @Test
    @DisplayName("Chỉ quyền ghi mới khai được; quyền xem đọc được danh mục và cách cộng")
    void permissions() {
        signInWith(IndicatorMeasurePermissions.READ);
        IndicatorMeasureResponse row = controller.list(new LinkedMultiValueMap<>(Map.of(
                "q", List.of(CODE), "_start", List.of("0"), "_end", List.of("10")))).getBody().getFirst();
        assertEquals("LUOT", row.measureKind());
        assertEquals("SUM", row.quantityRule());
        assertDoesNotThrow(() -> controller.sheets());
        assertThrows(AccessDeniedException.class,
                () -> controller.declare(new IndicatorMeasureRequest(List.of(CODE), "NGUOI", null)));

        signInWith(IndicatorMeasurePermissions.READ, IndicatorMeasurePermissions.WRITE);
        IndicatorMeasureResponse saved = controller.declare(new IndicatorMeasureRequest(List.of(CODE), "NGUOI", ""))
                .getFirst();
        assertEquals("MAX", saved.quantityRule());
        assertNull(saved.note());

        signInWith("summary:read");
        assertThrows(AccessDeniedException.class, () -> controller.list(new LinkedMultiValueMap<>()));
    }
}
