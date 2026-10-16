package com.dth.frw.module.security.user.service;

import com.dth.frw.domain.asxh.unit.ReportUnit;
import com.dth.frw.domain.catalog.department.Department;
import com.dth.frw.domain.catalog.organization.Organization;
import com.dth.frw.domain.security.role.Role;
import com.dth.frw.domain.security.user.User;
import com.dth.frw.domain.security.user.UserStatus;
import com.dth.frw.module.asxh.unit.service.ReportUnitService;
import com.dth.frw.module.catalog.department.service.DepartmentService;
import com.dth.frw.module.catalog.organization.service.OrganizationService;
import com.dth.frw.module.security.role.service.RoleService;
import com.dth.frw.module.security.token.service.RefreshTokenService;
import com.dth.frw.module.security.user.api.dto.DepartmentRef;
import com.dth.frw.module.security.user.api.dto.OrganizationRef;
import com.dth.frw.module.security.user.api.dto.ReportUnitRef;
import com.dth.frw.module.security.user.api.dto.RoleRef;
import com.dth.frw.module.security.user.api.dto.UserPatchRequest;
import com.dth.frw.module.security.user.api.dto.UserRequest;
import com.dth.frw.module.security.user.repo.UserRepository;
import com.dth.frw.module.security.user.repo.UserSpecifications;
import com.dth.frw.shared.exception.ConflictException;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.AuthoritiesChanged;
import com.dth.frw.shared.security.CurrentUser;
import com.dth.frw.shared.web.ListParams;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UserService {

    /**
     * The role the system cannot afford to have nobody holding.
     *
     * <p>Only {@code users:write} and {@code roles:write} can restore access
     * once they are gone, and both are granted through this role in the seed
     * data — so the last active holder of it is protected from being demoted,
     * disabled or deleted.
     */
    private static final String ADMIN_ROLE_CODE = "ADMIN";

    /** Sort properties the list endpoint accepts; anything else is ignored. */
    private static final Set<String> SORTABLE =
            Set.of("id", "username", "email", "fullName", "status", "createdAt", "lastLoginAt");

    private static final Sort DEFAULT_SORT = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

    private final UserRepository repository;

    // Roles are resolved through the role feature's own service rather than its
    // repository, which also means an unknown role id produces the same 404 the
    // role endpoints would.
    private final RoleService roleService;

    // Placement is resolved the same way roles are: through each feature's own
    // service, so an unknown id produces the same 404 that resource's endpoints
    // would. Neither of these depends on this service, so there is no cycle to
    // route around the way AuthorityCache needs an event.
    private final OrganizationService organizationService;

    private final DepartmentService departmentService;

    // Đơn vị báo cáo ASXH của tài khoản (cấp Đơn vị), giải qua service của slice đơn vị như
    // tổ chức / phòng ban ở trên: id lạ ra đúng 404 của endpoint đơn vị. ReportUnitService
    // không phụ thuộc ngược lại service này (đồng bộ trạng thái đơn vị → tài khoản đi qua
    // sự kiện, xem ReportUnitAccountSync), nên không có vòng phụ thuộc.
    private final ReportUnitService reportUnitService;

    // Disabling an account or resetting its password has to end the sessions
    // already open under it, or the change would not take effect until the
    // refresh token expired days later.
    private final RefreshTokenService refreshTokenService;

    private final PasswordEncoder passwordEncoder;

    // Announces that somebody's grants moved, for the auth feature's cache to
    // act on. An event rather than a call to that cache, because the cache
    // needs this service to populate itself: a direct dependency each way is a
    // cycle Spring would refuse to construct. See AuthoritiesChanged.
    private final ApplicationEventPublisher events;

    public UserService(UserRepository repository,
                       RoleService roleService,
                       OrganizationService organizationService,
                       DepartmentService departmentService,
                       ReportUnitService reportUnitService,
                       RefreshTokenService refreshTokenService,
                       PasswordEncoder passwordEncoder,
                       ApplicationEventPublisher events) {
        this.repository = repository;
        this.roleService = roleService;
        this.organizationService = organizationService;
        this.departmentService = departmentService;
        this.reportUnitService = reportUnitService;
        this.refreshTokenService = refreshTokenService;
        this.passwordEncoder = passwordEncoder;
        this.events = events;
    }

    public Page<User> list(ListParams params) {
        return repository.findAll(
                UserSpecifications.from(params),
                params.pageable(SORTABLE, DEFAULT_SORT));
    }

    public User get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    public List<User> getMany(List<Long> ids) {
        return repository.findAllById(ids);
    }

    /**
     * Resolves the identifier typed into the sign-in form, which may be a
     * username or an email address. Used by the auth feature.
     */
    public Optional<User> findForAuthentication(String identifier) {
        return repository.findByUsernameOrEmail(identifier.trim());
    }

    @Transactional
    public User create(UserRequest request) {
        String username = request.username().trim();
        String email = request.email().trim().toLowerCase();

        requireUsernameAvailable(username, null);
        requireEmailAvailable(email, null);

        User user = new User(
                username,
                email,
                passwordEncoder.encode(request.password()),
                request.fullName().trim(),
                request.status() == null ? UserStatus.ACTIVE : request.status());
        user.setRoles(resolveRoles(request.roles()));

        Placement placement = resolvePlacement(request.organization(), request.department(), null, null);
        user.setOrganization(placement.organization());
        user.setDepartment(placement.department());

        ReportUnit reportUnit = resolveReportUnit(request.reportUnit(), null);
        requireReportUnitAssignable(reportUnit, null, user.getStatus());
        user.setReportUnit(reportUnit);

        return repository.save(user);
    }

    @Transactional
    public User update(Long id, UserPatchRequest request) {
        User user = get(id);

        if (request.username() != null) {
            String username = request.username().trim();
            requireUsernameAvailable(username, user.getId());
            user.setUsername(username);
        }
        if (request.email() != null) {
            String email = request.email().trim().toLowerCase();
            requireEmailAvailable(email, user.getId());
            user.setEmail(email);
        }
        if (request.fullName() != null) {
            user.setFullName(request.fullName().trim());
        }

        // Resolved as a pair, because neither field is meaningful on its own:
        // a request may move the organization and the department together, or
        // send only one and have the other implied or refused.
        Placement placement = resolvePlacement(
                request.organization(), request.department(), user.getOrganization(), user.getDepartment());
        user.setOrganization(placement.organization());
        user.setDepartment(placement.department());

        // Đơn vị báo cáo và trạng thái được kiểm theo trạng thái SAU khi lưu: gắn vào đơn vị đã
        // có tài khoản khác (BR-69.2), hoặc để tài khoản hoạt động trong đơn vị đã ngừng hoạt
        // động (UC-02 3b), đều bị từ chối trước khi ghi đơn vị vào entity.
        ReportUnit reportUnit = resolveReportUnit(request.reportUnit(), user.getReportUnit());
        UserStatus targetStatus = request.status() == null ? user.getStatus() : request.status();
        if (request.reportUnit() != null || request.status() != null) {
            requireReportUnitAssignable(reportUnit, user.getId(), targetStatus);
        }
        user.setReportUnit(reportUnit);

        // Both of these can take the last administrator away, so they are
        // checked against the state the request is asking for, not the state
        // the row is currently in.
        Set<Role> roles = request.roles() == null ? user.getRoles() : resolveRoles(request.roles());
        UserStatus status = request.status() == null ? user.getStatus() : request.status();
        requireAdminSurvives(user, roles, status);

        if (request.roles() != null) {
            user.setRoles(roles);
        }

        boolean wasActive = user.canSignIn();
        user.setStatus(status);
        User saved = repository.save(user);

        // An account that just stopped being able to sign in must also stop
        // being able to renew a token it already holds.
        if (wasActive && !saved.canSignIn()) {
            refreshTokenService.revokeAllFor(saved, Instant.now());
        }

        // Only when the request touched something authorisation depends on.
        // Correcting a surname changes nothing about what the account may do,
        // and evicting on it would throw away a cache entry for no reason.
        //
        // Placement is on this list because it is now an input to authorisation
        // and not only to the org chart: a data scope can read
        // user.departmentId, and the cached principal is built from this entry.
        // Without publishing here, moving somebody between departments would
        // take effect only when the cache expired -- degraded rather than
        // wrong, but a minute in which they still see their old team's rows.
        //
        // Đơn vị báo cáo cũng vậy: phạm vi phiếu của tài khoản đọc nó từ bộ nhớ đệm quyền.
        if (request.roles() != null || request.status() != null
                || request.organization() != null || request.department() != null
                || request.reportUnit() != null) {
            events.publishEvent(new AuthoritiesChanged.ForUser(saved.getId()));
        }
        return saved;
    }

    /**
     * Sets somebody else's password, as an administrator.
     *
     * <p>Every session open under the account is ended, because the usual
     * reason to do this is that the account may be in the wrong hands.
     */
    @Transactional
    public User setPassword(Long id, String rawPassword) {
        User user = get(id);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        User saved = repository.save(user);
        refreshTokenService.revokeAllFor(saved, Instant.now());
        return saved;
    }

    /**
     * Changes the signed-in user's own password, having checked the current one.
     *
     * <p>Requiring the current password is what makes this safe on a machine
     * somebody walked away from: a stolen session alone should not be enough to
     * lock the real owner out of their account.
     */
    @Transactional
    public User changeOwnPassword(Long id, String currentPassword, String newPassword) {
        User user = get(id);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ConflictException("Mật khẩu hiện tại chưa đúng.");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        User saved = repository.save(user);
        // Other sessions end; the one making the change gets a fresh pair back
        // from the controller, so the person changing their password is not
        // signed out by their own action.
        refreshTokenService.revokeAllFor(saved, Instant.now());
        return saved;
    }

    /** Stamps the successful sign-in. Called by the auth feature. */
    @Transactional
    public void recordLogin(User user, Instant when) {
        user.setLastLoginAt(when);
        repository.save(user);
    }

    @Transactional
    public User delete(Long id) {
        User user = get(id);

        // Deleting the account you are signed in as is almost always a slip,
        // and it is unrecoverable. Disabling it is the reversible version of
        // whatever was intended.
        if (CurrentUser.id().filter(user.getId()::equals).isPresent()) {
            throw new ConflictException(
                    "Không thể xoá tài khoản bạn đang đăng nhập. Nếu muốn dừng tài khoản này, hãy chuyển sang ngừng hoạt động.");
        }
        requireAdminSurvives(user, Set.of(), UserStatus.INACTIVE);

        repository.delete(user);
        // The cache would find no row and drop the entry on its own, but only
        // when something next asks for it. Saying so outright means a token
        // held by the deleted account stops working immediately rather than at
        // the next lookup.
        events.publishEvent(new AuthoritiesChanged.ForUser(user.getId()));

        // Returned so the controller can echo the deleted row: the data
        // provider parses the DELETE response body.
        return user;
    }

    private Set<Role> resolveRoles(List<RoleRef> refs) {
        List<Long> ids = refs.stream().map(RoleRef::id).toList();
        return new LinkedHashSet<>(roleService.resolveAll(ids));
    }

    /**
     * Đơn vị báo cáo mà request muốn gắn — cùng quy ước ba trạng thái với tổ chức: bỏ trường
     * giữ nguyên {@code current}, {@code {"id": null}} bỏ gắn, {@code {"id": n}} gắn đơn vị n.
     */
    private ReportUnit resolveReportUnit(ReportUnitRef ref, ReportUnit current) {
        if (ref == null) {
            return current;
        }
        return ref.id() == null ? null : reportUnitService.get(ref.id());
    }

    /**
     * BR-69.2: một đơn vị — một tài khoản. UC-02 3b: không để tài khoản hoạt động trong đơn vị
     * đã ngừng hoạt động.
     *
     * @param selfId id tài khoản đang sửa, {@code null} khi tạo mới
     */
    private void requireReportUnitAssignable(ReportUnit unit, Long selfId, UserStatus status) {
        if (unit == null) {
            return;
        }
        boolean takenByAnother = repository.findByReportUnitId(unit.getId()).stream()
                .anyMatch(other -> !other.getId().equals(selfId));
        if (takenByAnother) {
            throw new ConflictException(
                    "Đơn vị %s đã được gắn với một tài khoản khác. Mỗi đơn vị chỉ có một tài khoản."
                            .formatted(unit.getName()));
        }
        if (!unit.isActive() && status == UserStatus.ACTIVE) {
            throw new ConflictException(
                    "Không thể để tài khoản hoạt động vì đơn vị %s đã ngừng hoạt động."
                            .formatted(unit.getName()));
        }
    }

    // ------------------------------------------- đồng bộ theo trạng thái đơn vị

    /**
     * Ngừng hoạt động đơn vị (BR-02.1, BR-70.2): mọi tài khoản đang hoạt động gắn với đơn vị
     * và toàn bộ cây đơn vị con chuyển sang ngừng hoạt động, phiên đăng nhập bị kết thúc.
     * Gọi từ {@code ReportUnitAccountSync}, trong giao dịch của lần sửa đơn vị.
     *
     * @return số tài khoản vừa bị ngừng hoạt động
     */
    @Transactional
    public int deactivateAccountsOfUnitTree(Long unitId) {
        List<Long> ids = repository.findActiveIdsInReportUnitTree(unitId);
        if (ids.isEmpty()) {
            return 0;
        }
        Instant now = Instant.now();
        int changed = 0;
        for (User user : repository.findAllById(ids)) {
            if (!user.canSignIn()) {
                continue;
            }
            // Tài khoản đơn vị không bao giờ là quản trị viên cuối cùng, nhưng vẫn giữ cùng hàng
            // rào với đường sửa tay để không lối tắt nào khoá hết người quản trị.
            requireAdminSurvives(user, user.getRoles(), UserStatus.INACTIVE);
            user.setStatus(UserStatus.INACTIVE);
            repository.save(user);
            refreshTokenService.revokeAllFor(user, now);
            events.publishEvent(new AuthoritiesChanged.ForUser(user.getId()));
            changed++;
        }
        return changed;
    }

    /**
     * Kích hoạt lại đơn vị (BR-02.2, UC-02 3a): chỉ bật lại tài khoản của CHÍNH đơn vị đó đang
     * ngừng hoạt động; tài khoản bị khoá giữ nguyên, đơn vị con không lan.
     *
     * @return số tài khoản vừa được bật lại
     */
    @Transactional
    public int reactivateAccountsOfUnit(Long unitId) {
        int changed = 0;
        for (User user : repository.findByReportUnitId(unitId)) {
            if (user.getStatus() == UserStatus.INACTIVE) {
                user.setStatus(UserStatus.ACTIVE);
                repository.save(user);
                events.publishEvent(new AuthoritiesChanged.ForUser(user.getId()));
                changed++;
            }
        }
        return changed;
    }

    /** Where a request wants the account placed, resolved and agreed with itself. */
    private record Placement(Organization organization, Department department) {
    }

    /**
     * Works out the organization and department a request is asking for.
     *
     * <p>Each reference has three states, and they are not the same thing:
     * absent leaves the field as it was, {@code {"id": null}} clears it, and
     * {@code {"id": n}} sets it. The distinction cannot live at the record
     * level — Jackson reports an omitted object and an explicit {@code null}
     * identically — which is why {@link OrganizationRef} and {@link
     * DepartmentRef} carry a nullable id rather than a {@code @NotNull} one.
     *
     * <p>Three rules then settle the pair:
     *
     * <ul>
     *   <li>Clearing the organization clears the department with it. A
     *       department outside an organization is a state the schema does not
     *       allow, so the alternative would be to reject the request over
     *       something the caller plainly did not mean.
     *   <li>A department with no organization beside it supplies its own. That
     *       is the ordinary case from a form whose department picker is already
     *       filtered by organization, and there is only one organization it
     *       could legally be.
     *   <li>A department that disagrees with the organization is refused. This
     *       is the one the database would catch anyway, through the composite
     *       foreign key on {@code users}; checking it here only buys a message
     *       that names both instead of naming a constraint.
     * </ul>
     */
    private Placement resolvePlacement(
            OrganizationRef organizationRef,
            DepartmentRef departmentRef,
            Organization currentOrganization,
            Department currentDepartment) {

        Organization organization = organizationRef == null
                ? currentOrganization
                : organizationRef.id() == null ? null : organizationService.get(organizationRef.id());

        Department department = departmentRef == null
                ? currentDepartment
                : departmentRef.id() == null ? null : departmentService.get(departmentRef.id());

        boolean organizationCleared = organizationRef != null && organizationRef.id() == null;
        if (organizationCleared) {
            department = null;
        }

        if (department == null) {
            return new Placement(organization, null);
        }

        if (organization == null) {
            return new Placement(department.getOrganization(), department);
        }

        if (!organization.getId().equals(department.getOrganization().getId())) {
            throw new ConflictException(
                    "Phòng ban %s thuộc %s, không thuộc %s. Bạn chọn lại phòng ban cho đúng đơn vị công tác."
                            .formatted(
                                    department.getName(),
                                    department.getOrganization().getName(),
                                    organization.getName()));
        }
        return new Placement(organization, department);
    }

    /**
     * Refuses a change that would leave no active administrator.
     *
     * @param user   the account being changed
     * @param roles  the roles it would hold afterwards
     * @param status the status it would have afterwards
     */
    private void requireAdminSurvives(User user, Set<Role> roles, UserStatus status) {
        boolean wasAdmin = user.roleCodes().contains(ADMIN_ROLE_CODE) && user.canSignIn();
        boolean staysAdmin = roles.stream().anyMatch(role -> ADMIN_ROLE_CODE.equals(role.getCode()))
                && status == UserStatus.ACTIVE;

        if (wasAdmin && !staysAdmin && repository.countActiveWithRole(ADMIN_ROLE_CODE) <= 1) {
            throw new ConflictException(
                    "Đây là quản trị viên cuối cùng còn hoạt động. Hãy cấp vai trò quản trị cho một tài khoản khác trước.");
        }
    }

    private void requireUsernameAvailable(String username, Long selfId) {
        repository.findByUsernameIgnoreCase(username).ifPresent(existing -> {
            if (!existing.getId().equals(selfId)) {
                throw new ConflictException(
                        "Tên đăng nhập %s đã có người dùng. Bạn chọn tên đăng nhập khác.".formatted(username));
            }
        });
    }

    private void requireEmailAvailable(String email, Long selfId) {
        repository.findByEmailIgnoreCase(email).ifPresent(existing -> {
            if (!existing.getId().equals(selfId)) {
                throw new ConflictException(
                        "Thư điện tử %s đã được dùng cho tài khoản khác.".formatted(email));
            }
        });
    }
}
