package com.dth.frw.module.security.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.dth.frw.domain.security.user.User;
import com.dth.frw.domain.security.user.UserStatus;
import com.dth.frw.module.security.auth.api.dto.LoginRequest;
import com.dth.frw.module.security.user.repo.UserRepository;
import com.dth.frw.module.security.user.service.UserService;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Khoá đăng nhập tạm thời: sai 5 lần liên tiếp thì khoá, đang khoá thì mật khẩu đúng cũng bị từ
 * chối, hết khoá thì đăng nhập được và đếm lại từ đầu; quản trị đặt lại mật khẩu thì mở khoá.
 *
 * <p>Không bọc {@code @Transactional}: lần sai được ghi trong giao dịch riêng (REQUIRES_NEW) nên
 * test phải chạy trên dữ liệu đã lưu thật. Tài khoản thử tạo riêng và xoá ở {@code @AfterEach}.
 */
@SpringBootTest
class LoginLockoutTest {

    private static final String PASSWORD = "Dung@12345";

    @Autowired
    private AuthService auth;

    @Autowired
    private UserService users;

    @Autowired
    private UserRepository repository;

    @Autowired
    private PasswordEncoder encoder;

    @Autowired
    private JdbcTemplate jdbc;

    private Long userId;
    private String username;

    @BeforeEach
    void setUp() {
        username = "kt.khoa." + UUID.randomUUID().toString().substring(0, 8);
        User user = new User(username, username + "@kiemthu.local", encoder.encode(PASSWORD),
                "Tài khoản thử khoá đăng nhập", UserStatus.ACTIVE);
        userId = repository.save(user).getId();
    }

    @AfterEach
    void tearDown() {
        jdbc.update("delete from refresh_tokens where user_id = ?", userId);
        jdbc.update("delete from users where id = ?", userId);
    }

    private BadCredentialsException wrong() {
        return assertThrows(BadCredentialsException.class,
                () -> auth.login(new LoginRequest(username, "Sai@00000")));
    }

    private User reload() {
        return repository.findById(userId).orElseThrow();
    }

    @Test
    @DisplayName("Sai 4 lần: vẫn báo sai mật khẩu; lần 5: khoá và nói rõ thời gian chờ")
    void fifthFailureLocks() {
        for (int i = 0; i < 4; i++) {
            assertEquals("Tên đăng nhập hoặc mật khẩu không đúng.", wrong().getMessage());
        }
        assertEquals(4, reload().getFailedLoginCount());
        assertNull(reload().getLockedUntil());

        assertTrue(wrong().getMessage().startsWith("Bạn đã nhập sai mật khẩu nhiều lần nên tài khoản tạm khoá."));
        assertNotNull(reload().getLockedUntil());
    }

    @Test
    @DisplayName("Đang khoá: mật khẩu đúng cũng bị từ chối")
    void lockedRefusesCorrectPassword() {
        for (int i = 0; i < 5; i++) wrong();

        BadCredentialsException error = assertThrows(BadCredentialsException.class,
                () -> auth.login(new LoginRequest(username, PASSWORD)));
        assertTrue(error.getMessage().contains("tạm khoá"));
    }

    @Test
    @DisplayName("Tài khoản bị quản trị khoá: đúng mật khẩu thì báo đã khoá, sai mật khẩu vẫn báo chung")
    void inactiveAccountSaysLockedOnlyWithRightPassword() {
        jdbc.update("update users set status = 'INACTIVE' where id = ?", userId);

        BadCredentialsException locked = assertThrows(BadCredentialsException.class,
                () -> auth.login(new LoginRequest(username, PASSWORD)));
        assertTrue(locked.getMessage().startsWith("Tài khoản của bạn đã bị khoá."));

        assertEquals("Tên đăng nhập hoặc mật khẩu không đúng.", wrong().getMessage(),
                "sai mật khẩu thì không lộ tài khoản có bị khoá hay không");
    }

    @Test
    @DisplayName("Hết khoá: đăng nhập đúng được và đếm lại từ đầu")
    void expiredLockAllowsLoginAndResets() {
        for (int i = 0; i < 5; i++) wrong();
        jdbc.update("update users set locked_until = ? where id = ?",
                java.sql.Timestamp.from(Instant.now().minusSeconds(60)), userId);

        assertNotNull(auth.login(new LoginRequest(username, PASSWORD)).accessToken());
        assertEquals(0, reload().getFailedLoginCount());
        assertNull(reload().getLockedUntil());
    }

    @Test
    @DisplayName("Hết khoá rồi sai một lần: chưa khoá lại ngay")
    void expiredLockStartsCountingAgain() {
        for (int i = 0; i < 5; i++) wrong();
        jdbc.update("update users set locked_until = ? where id = ?",
                java.sql.Timestamp.from(Instant.now().minusSeconds(60)), userId);

        assertEquals("Tên đăng nhập hoặc mật khẩu không đúng.", wrong().getMessage());
        assertEquals(1, reload().getFailedLoginCount());
        assertNull(reload().getLockedUntil());
    }

    @Test
    @DisplayName("Quản trị đặt lại mật khẩu: mở khoá")
    void adminPasswordResetUnlocks() {
        for (int i = 0; i < 5; i++) wrong();
        users.setPassword(userId, "Moi@123456");

        assertNotNull(auth.login(new LoginRequest(username, "Moi@123456")).accessToken());
    }
}
