package com.dth.frw.module.security.auth.service;

import com.dth.frw.module.security.user.repo.UserRepository;
import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khoá đăng nhập tạm thời để chặn dò mật khẩu: nhập sai {@code maxFailures} lần liên tiếp thì tài
 * khoản bị khoá {@code lockDuration}; hết khoá thì đếm lại từ đầu. Đăng nhập đúng hoặc quản trị
 * đặt lại mật khẩu cũng đếm lại từ đầu ({@code User.clearLoginFailures}).
 *
 * <p>Ghi trong giao dịch RIÊNG ({@code REQUIRES_NEW}): lần đăng nhập sai kết thúc bằng
 * {@code BadCredentialsException}, giao dịch của {@code AuthService.login} bị cuộn lại — đếm trong
 * đó thì không bao giờ lưu được.
 *
 * <p>Chỉ đếm cho tài khoản có thật; tên đăng nhập không tồn tại không bị khoá (không có gì để khoá).
 */
@Service
public class LoginAttemptService {

    private final UserRepository repository;
    private final int maxFailures;
    private final Duration lockDuration;

    public LoginAttemptService(
            UserRepository repository,
            @Value("${app.security.login.max-failures:5}") int maxFailures,
            @Value("${app.security.login.lock-duration:15m}") Duration lockDuration) {
        this.repository = repository;
        this.maxFailures = maxFailures;
        this.lockDuration = lockDuration;
    }

    /**
     * Ghi một lần nhập sai.
     *
     * @return thời điểm hết khoá nếu lần sai này làm tài khoản bị khoá, ngược lại {@code null}
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Instant recordFailure(Long userId, Instant now) {
        repository.clearExpiredLoginLock(userId, now);
        repository.incrementFailedLogins(userId);
        Instant until = now.plus(lockDuration);
        return repository.lockLoginIfOverLimit(userId, maxFailures, now, until) > 0 ? until : null;
    }

    /** Câu báo khi tài khoản đang khoá, kèm số phút còn lại (làm tròn lên, ít nhất 1). */
    public static String lockedMessage(Instant lockedUntil, Instant now) {
        long seconds = Math.max(0, Duration.between(now, lockedUntil).getSeconds());
        long minutes = Math.max(1, (seconds + 59) / 60);
        return "Bạn đã nhập sai mật khẩu nhiều lần nên tài khoản tạm khoá. Bạn thử lại sau "
                + minutes + " phút.";
    }
}
