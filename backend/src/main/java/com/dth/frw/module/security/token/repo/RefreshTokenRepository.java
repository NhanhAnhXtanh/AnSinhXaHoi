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
