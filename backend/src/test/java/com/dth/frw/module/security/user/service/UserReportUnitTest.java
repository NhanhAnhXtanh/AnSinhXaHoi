package com.dth.frw.module.security.user.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.dth.frw.domain.asxh.unit.ReportBlock;
import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.domain.asxh.unit.ReportUnitType;
import com.dth.frw.domain.security.role.Role;
import com.dth.frw.domain.security.user.User;
import com.dth.frw.domain.security.user.UserStatus;
import com.dth.frw.module.asxh.unit.api.dto.ReportUnitPatchRequest;
import com.dth.frw.module.asxh.unit.service.ReportUnitService;
import com.dth.frw.module.security.user.api.dto.ReportUnitRef;
import com.dth.frw.module.security.user.api.dto.RoleRef;
import com.dth.frw.module.security.user.api.dto.UserPatchRequest;
import com.dth.frw.module.security.user.api.dto.UserRequest;
import com.dth.frw.shared.exception.ConflictException;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tài khoản gắn đơn vị báo cáo (UC-69, UC-70, UC-02): một đơn vị một tài khoản, không để tài
 * khoản hoạt động trong đơn vị đã ngừng, ngừng / bật đơn vị kéo theo tài khoản.
 *
 * <p>CSDL thật, mỗi test một giao dịch rồi cuộn lại; mã đơn vị, tên đăng nhập ngẫu nhiên.
 */
@SpringBootTest
@Transactional
class UserReportUnitTest {

    @Autowired
    private UserService users;

    @Autowired
    private ReportUnitService units;

    @Autowired
    private EntityManager entityManager;

    private String suffix;
    private ReportUnit district;
    private ReportUnit ward;
    private Long roleId;

    @BeforeEach
    void createUnits() {
        suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        district = new ReportUnit("HU" + suffix, "UBND huyện Kiểm Thử", null,
                ReportUnitType.UBND_HUYEN, ReportBlock.HUYEN);
        entityManager.persist(district);
        ward = new ReportUnit("XA" + suffix, "UBND xã Kiểm Thử", district,
                ReportUnitType.UBND_XA, ReportBlock.XA);
        entityManager.persist(ward);

        // Vai trò hệ thống "USER" (seed 005) — không phải ADMIN, để hàng rào "quản trị viên cuối
        // cùng" không chen vào test này.
        Role role = entityManager.createQuery("select r from Role r where r.code = 'USER'", Role.class)
                .getSingleResult();
        roleId = role.getId();
    }

    @Test
    @DisplayName("Gắn đơn vị khi tạo; đơn vị đã có tài khoản thì từ chối bằng câu tiếng Việt")
    void oneAccountPerUnit() {
        User first = users.create(request("a", ward.getId()));
        assertEquals(ward.getId(), first.getReportUnit().getId());

        ConflictException refused = assertThrows(ConflictException.class,
                () -> users.create(request("b", ward.getId())));
        assertEquals(true, refused.getMessage().contains("đã được gắn với một tài khoản khác"));

        // Sửa chính tài khoản đó, gửi lại đúng đơn vị của nó, không bị coi là trùng.
        users.update(first.getId(), patch(new ReportUnitRef(ward.getId()), null));

        // Bỏ gắn: {"id": null}.
        User cleared = users.update(first.getId(), patch(new ReportUnitRef(null), null));
        assertNull(cleared.getReportUnit());
    }

    @Test
    @DisplayName("Ngừng hoạt động đơn vị cấp trên ngừng luôn tài khoản của đơn vị con; bật lại chỉ bật chính đơn vị")
    void unitActivationCascadesToAccounts() {
        User districtAccount = users.create(request("h", district.getId()));
        User wardAccount = users.create(request("x", ward.getId()));

        units.update(district.getId(), unitActive(false));
        entityManager.flush();
        // Cây con được ngừng bằng một câu UPDATE gốc: nạp lại để thấy trạng thái trong CSDL
        // (trên request thật mỗi thao tác là một giao dịch riêng nên không cần bước này).
        entityManager.refresh(ward);
        entityManager.refresh(districtAccount);
        entityManager.refresh(wardAccount);
        assertEquals(UserStatus.INACTIVE, districtAccount.getStatus());
        assertEquals(UserStatus.INACTIVE, wardAccount.getStatus(), "BR-02.1: lan xuống cây con");

        // UC-02 3b: không bật tài khoản khi đơn vị còn ngừng hoạt động.
        assertThrows(ConflictException.class,
                () -> users.update(wardAccount.getId(), patch(null, UserStatus.ACTIVE)));

        units.update(district.getId(), unitActive(true));
        entityManager.flush();
        entityManager.refresh(districtAccount);
        entityManager.refresh(wardAccount);
        assertEquals(UserStatus.ACTIVE, districtAccount.getStatus(), "BR-02.2: bật lại tài khoản của chính đơn vị");
        assertEquals(UserStatus.INACTIVE, wardAccount.getStatus(), "kích hoạt lại không lan xuống");
    }

    private UserRequest request(String tag, Long unitId) {
        String username = "kt." + tag + "." + suffix;
        return new UserRequest(username, username + "@kiemthu.local", "Cán bộ kiểm thử", "MatKhau@123",
                null, null, null, new ReportUnitRef(unitId), List.of(new RoleRef(roleId)));
    }

    private static UserPatchRequest patch(ReportUnitRef reportUnit, UserStatus status) {
        return new UserPatchRequest(null, null, null, status, null, null, reportUnit, null);
    }

    private static ReportUnitPatchRequest unitActive(boolean active) {
        return new ReportUnitPatchRequest(null, null, null, null, null, active, null);
    }
}
