package com.dth.frw.module.asxh.summary;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.dth.frw.module.asxh.annual.security.AnnualReportPermissions;
import com.dth.frw.module.asxh.summary.api.SummaryController;
import com.dth.frw.module.asxh.summary.api.SummaryMasterDataController;
import com.dth.frw.shared.security.JwtService;
import java.time.LocalDate;
import java.util.Arrays;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Người xem báo cáo năm (UBND: chỉ {@code annual_reports:read}) mở phiếu năm thì script biểu năm gọi
 * {@code /summary/period-organizations} và {@code /master/organization-units} để dựng dòng đơn vị — trước
 * khi sửa hai endpoint này trả 403 nên các tab theo đơn vị trống. Số liệu tổng hợp sống
 * ({@code /summary/data}, {@code /summary/school-year}) vẫn chỉ cho quyền Tổng hợp; tài khoản đơn vị không
 * gọi được gì.
 */
@SpringBootTest
class SummaryAnnualReaderAccessTest {

    private static final LocalDate FROM = LocalDate.of(2026, 1, 1);
    private static final LocalDate TO = LocalDate.of(2026, 12, 31);

    @Autowired
    private SummaryController summary;

    @Autowired
    private SummaryMasterDataController master;

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    private static void signInWith(String... authorities) {
        Jwt jwt = Jwt.withTokenValue("kiem-thu")
                .header("alg", "none")
                .subject("0")
                .claim(JwtService.CLAIM_USERNAME, "kiem-thu")
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt,
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()));
    }

    @Test
    @DisplayName("UBND (chỉ quyền xem báo cáo năm): lấy được danh sách đơn vị cho biểu năm, không lấy được số liệu sống")
    void annualReaderGetsUnitListsOnly() {
        signInWith(AnnualReportPermissions.ANNUAL_READ);

        assertDoesNotThrow(() -> summary.periodOrganizations(null, FROM, TO, null, "1b"));
        assertDoesNotThrow(() -> master.organizationUnits(null));
        assertThrows(AccessDeniedException.class,
                () -> summary.data(null, FROM, TO, null, null, null, null, null, false));
        assertThrows(AccessDeniedException.class,
                () -> summary.schoolYear(2026, null, null, null, null, null));
    }

    @Test
    @DisplayName("Tài khoản đơn vị (không quyền Tổng hợp / báo cáo năm): không gọi được endpoint tổng hợp nào")
    void unitReporterDenied() {
        signInWith("input_reports:read");

        assertThrows(AccessDeniedException.class, () -> summary.periodOrganizations(null, FROM, TO, null, "1b"));
        assertThrows(AccessDeniedException.class, () -> master.organizationUnits(null));
        assertThrows(AccessDeniedException.class,
                () -> summary.data(null, FROM, TO, null, null, null, null, null, true));
    }
}
