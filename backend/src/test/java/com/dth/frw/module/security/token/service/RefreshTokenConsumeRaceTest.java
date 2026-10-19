package com.dth.frw.module.security.token.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dth.frw.domain.security.token.RefreshToken;
import com.dth.frw.domain.security.user.User;
import com.dth.frw.module.security.token.repo.RefreshTokenRepository;
import com.dth.frw.shared.security.JwtProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Cùng một refresh token gửi hai lần ĐỒNG THỜI (hai tab cùng làm mới, hoặc kẻ trộm và người dùng
 * thật): trước đây cả hai lượt đều đọc thấy token còn dùng được, cùng đốt bằng {@code save} và cùng
 * nhận cặp token mới — xoay vòng token mất tác dụng chống trộm. Giờ đốt bằng UPDATE có điều kiện:
 * chỉ lượt đổi được dòng mới thắng, lượt kia 401 tiếng Việt.
 *
 * <p>Mô phỏng hai lượt chen nhau bằng kho trả "token còn dùng được" cho CẢ HAI lần đọc, còn câu đốt
 * có điều kiện đổi được 1 dòng ở lần đầu và 0 dòng ở lần sau — đúng điều PostgreSQL làm với hai câu
 * {@code UPDATE ... where revoked_at is null} đụng cùng một dòng.
 */
class RefreshTokenConsumeRaceTest {

    private final RefreshTokenRepository repository = mock(RefreshTokenRepository.class);
    private final RefreshTokenService service = new RefreshTokenService(repository,
            new JwtProperties("x".repeat(32), "kiem-thu", Duration.ofMinutes(15), Duration.ofDays(7)));

    @Test
    @DisplayName("Hai lần làm mới đồng thời bằng một token: chỉ một lần thành công, lần kia 401")
    void onlyOneConcurrentRefreshWins() {
        Instant now = Instant.now();
        User user = mock(User.class);
        RefreshToken token = new RefreshToken(user, "hash", now.plusSeconds(3600));
        ReflectionTestUtils.setField(token, "id", 77L);
        when(repository.findByTokenHash(anyString())).thenReturn(Optional.of(token));
        when(repository.revokeIfUnused(77L, now)).thenReturn(1, 0);

        assertSame(user, service.consume("token-tho", now));
        BadCredentialsException loser = assertThrows(BadCredentialsException.class,
                () -> service.consume("token-tho", now));
        assertEquals("Phiên đăng nhập đã hết hạn. Bạn đăng nhập lại để tiếp tục.", loser.getMessage());
        // Không còn đường đọc-rồi-ghi đè bằng save.
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("Token đã thu hồi / hết hạn: 401, không chạm tới câu đốt")
    void spentTokenRefused() {
        Instant now = Instant.now();
        RefreshToken expired = new RefreshToken(mock(User.class), "hash", now.minusSeconds(1));
        when(repository.findByTokenHash(anyString())).thenReturn(Optional.of(expired));

        assertThrows(BadCredentialsException.class, () -> service.consume("token-tho", now));
        verify(repository, never()).revokeIfUnused(any(), any());
    }
}
