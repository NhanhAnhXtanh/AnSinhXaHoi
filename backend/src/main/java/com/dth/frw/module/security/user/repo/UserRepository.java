package com.dth.frw.module.security.user.repo;

import com.dth.frw.domain.security.user.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    Optional<User> findByUsernameIgnoreCase(String username);

    Optional<User> findByEmailIgnoreCase(String email);

    /**
     * Resolves the identifier typed into the sign-in form, which may be either.
     *
     * <p>Accepting both is a convenience for the person signing in; it is safe
     * because {@code username} and {@code email} are each unique and neither
     * can be blank, so no single value can address two accounts.
     */
    @Query("select u from User u where lower(u.username) = lower(:identifier) "
            + "or lower(u.email) = lower(:identifier)")
    Optional<User> findByUsernameOrEmail(@Param("identifier") String identifier);

    /**
     * How many active accounts hold a given role.
     *
     * <p>Used to refuse the last administrator being demoted or disabled: a
     * system with nobody able to manage users is one that needs a database
     * client to repair.
     */
    @Query("select count(u) from User u join u.roles r "
            + "where r.code = :roleCode and u.status = com.dth.frw.domain.security.user.UserStatus.ACTIVE")
    long countActiveWithRole(@Param("roleCode") String roleCode);

    /** Tài khoản gắn với một đơn vị báo cáo ASXH — kiểm "một đơn vị — một tài khoản" (BR-69.2). */
    List<User> findByReportUnitId(Long reportUnitId);

    /** Id các tài khoản ĐANG HOẠT ĐỘNG của một đơn vị — người nhận thông báo của đơn vị. */
    @Query("select u.id from User u where u.reportUnit.id = :unitId "
            + "and u.status = com.dth.frw.domain.security.user.UserStatus.ACTIVE order by u.id")
    List<Long> findActiveIdsByReportUnitId(@Param("unitId") Long unitId);

    /** Id các tài khoản ĐANG HOẠT ĐỘNG giữ một vai trò (theo mã) — người nhận thông báo của Sở / UBND. */
    @Query("select distinct u.id from User u join u.roles r where r.code = :roleCode "
            + "and u.status = com.dth.frw.domain.security.user.UserStatus.ACTIVE order by u.id")
    List<Long> findActiveIdsByRoleCode(@Param("roleCode") String roleCode);

    /**
     * Id các tài khoản ĐANG HOẠT ĐỘNG gắn với đơn vị và toàn bộ cây đơn vị con của nó — để
     * ngừng hoạt động theo khi đơn vị ngừng hoạt động (BR-02.1).
     *
     * <p>CTE đệ quy trên bảng đơn vị, cùng cách {@code ReportUnitRepository.deactivateDescendants};
     * {@code UNION} (không {@code ALL}) để dữ liệu lỡ có vòng vẫn dừng. Đọc bảng đơn vị ở đây là
     * chủ ý: đi qua service đơn vị thì phải nạp cả cây vào bộ nhớ chỉ để lấy id.
     */
    @Query(nativeQuery = true, value = """
            WITH RECURSIVE tree(id) AS (
                SELECT u.id FROM asxh_report_units u WHERE u.id = :unitId
                UNION
                SELECT c.id FROM asxh_report_units c JOIN tree t ON c.parent_id = t.id
            )
            SELECT us.id FROM users us
             WHERE us.report_unit_id IN (SELECT id FROM tree) AND us.status = 'ACTIVE'
            """)
    List<Long> findActiveIdsInReportUnitTree(@Param("unitId") Long unitId);

    // ---- Khoá đăng nhập tạm thời (LoginAttemptService). Câu UPDATE thẳng: mỗi câu là một thao tác
    // nguyên tử trên dòng, nên nhiều lần thử song song không đếm sót; không đụng updated_at.

    /** Khoá cũ đã hết hạn: đếm lại từ đầu trước khi tính lần sai này. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update User u set u.failedLoginCount = 0, u.lockedUntil = null "
            + "where u.id = :id and u.lockedUntil is not null and u.lockedUntil <= :now")
    int clearExpiredLoginLock(@Param("id") Long id, @Param("now") Instant now);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update User u set u.failedLoginCount = u.failedLoginCount + 1 where u.id = :id")
    int incrementFailedLogins(@Param("id") Long id);

    /** Đủ số lần sai thì khoá tới {@code until}; trả 1 nếu lần này vừa khoá. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update User u set u.lockedUntil = :until "
            + "where u.id = :id and u.failedLoginCount >= :max "
            + "and (u.lockedUntil is null or u.lockedUntil <= :now)")
    int lockLoginIfOverLimit(@Param("id") Long id, @Param("max") int max,
                             @Param("now") Instant now, @Param("until") Instant until);
}
