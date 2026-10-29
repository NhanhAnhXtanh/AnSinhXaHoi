package com.dth.frw.module.security.token.repo;

import com.dth.frw.domain.security.token.RefreshToken;
import com.dth.frw.domain.security.user.User;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    /** Looks a presented token up by its digest; the token itself is never stored. */
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    List<RefreshToken> findByUserAndRevokedAtIsNull(User user);

    /**
     * Đốt token CÓ ĐIỀU KIỆN: chỉ đổi dòng còn chưa bị thu hồi, trả số dòng đã đổi (0 hoặc 1).
     *
     * <p>Đây là chỗ quyết định ai thắng khi cùng một token được gửi hai lần đồng thời (hai tab cùng
     * làm mới, hoặc kẻ trộm và người dùng thật): cả hai đều đọc thấy token còn dùng được, nhưng
     * PostgreSQL chỉ cho MỘT câu {@code UPDATE ... where revoked_at is null} đổi được dòng — câu thứ
     * hai chờ câu đầu commit rồi đánh giá lại điều kiện, được 0 dòng.
     */
    @Modifying(flushAutomatically = true)
    @Query("update RefreshToken t set t.revokedAt = :now where t.id = :id and t.revokedAt is null")
    int revokeIfUnused(@Param("id") Long id, @Param("now") Instant now);

    /**
     * Drops tokens that are already spent, so the table does not grow forever.
     *
     * <p>A revoked or expired row has no further effect on any decision — the
     * only thing it could still answer is "was this token ever used", which
     * nothing asks.
     */
    @Modifying
    @Query("delete from RefreshToken t where t.expiresAt < :before or t.revokedAt is not null")
    int deleteSpent(@Param("before") Instant before);
}
