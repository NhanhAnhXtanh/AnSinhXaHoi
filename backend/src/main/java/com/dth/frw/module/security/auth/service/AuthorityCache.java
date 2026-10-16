package com.dth.frw.module.security.auth.service;

import com.dth.frw.domain.security.user.User;
import com.dth.frw.module.security.user.service.UserService;
import com.dth.frw.shared.exception.ResourceNotFoundException;
import com.dth.frw.shared.security.AuthoritiesChanged;
import com.dth.frw.shared.security.rowlevel.RowLevelGeneration;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * What each account may do, held in memory so authorising a request costs no
 * database round trip.
 *
 * <p>This is the piece that lets the access token stay small <em>and</em> stay
 * dumb. The token names the caller; this answers what the caller may do; and
 * because the answer lives in memory rather than in claims signed minutes ago,
 * it can be thrown away the instant it stops being true.
 *
 * <p>It is also load-bearing beyond HTTP. Anything that has to ask "may this
 * account receive this?" per message — a notification, a metric, a log line —
 * asks here. A database read per message would be the same mistake as a
 * database read per request, multiplied by the message rate.
 *
 * <h2>Staying correct</h2>
 *
 * Three things drop an entry, and they are deliberately layered from precise to
 * blunt, so that a gap in one is covered by the next:
 *
 * <ol>
 *   <li><b>Events</b> from the feature that made the change, applied after its
 *       transaction commits. Exact, and immediate.</li>
 *   <li><b>Notifications from other nodes</b>, delivered by
 *       {@link AuthorityChangeChannel}. Same precision, one network hop later.</li>
 *   <li><b>A {@value #TTL_SECONDS}-second expiry</b> on every entry. Nothing
 *       should ever need it; it exists so that a path somebody forgets to
 *       publish an event from degrades to "wrong for a minute" instead of
 *       "wrong until the next restart".</li>
 * </ol>
 */
@Component
public class AuthorityCache {

    /** Safety net only — see the class comment. */
    static final long TTL_SECONDS = 60;

    private static final Duration TTL = Duration.ofSeconds(TTL_SECONDS);

    /**
     * Bounds the memory an unusually large user base can take.
     *
     * <p>Entries are per <em>active</em> account rather than per account, since
     * only a request populates one, so this is far above any realistic
     * concurrent load. Past it, the oldest entries are dropped and re-read on
     * demand: the cache gets slower, never wrong.
     */
    private static final int MAX_ENTRIES = 50_000;

    private final ConcurrentHashMap<Long, Entry> entries = new ConcurrentHashMap<>();

    private final UserService userService;

    /**
     * The row-level policy set's stamp, folded into this cache's own.
     *
     * <p>An interface from {@code shared/}, implemented by the policy cache, so
     * the dependency runs one way: this reads a string from there and that
     * feature knows nothing about this one. Reversing it would be the cycle
     * that forced {@code token/} into a slice of its own.
     *
     * <p>Folding it in is what means a policy change reaches an open tab through
     * the {@code X-Auth-Version} header that is already on every response —
     * rather than through a new header somebody has to remember to expose
     * through CORS.
     */
    private final RowLevelGeneration policies;

    public AuthorityCache(UserService userService, RowLevelGeneration policies) {
        this.userService = userService;
        this.policies = policies;
    }

    /**
     * The authorities for an account, or empty if there is no such account.
     *
     * <p>{@code canSignIn} travels with them rather than being checked
     * separately, because the caller has to refuse a disabled account and a
     * second lookup to find that out would undo the point of caching the first.
     */
    public Optional<Entry> get(long userId) {
        Entry cached = entries.get(userId);
        if (cached != null && !cached.isExpired()) {
            return Optional.of(cached);
        }

        // A miss races harmlessly: two threads may both load, and both write
        // the same value. Locking to prevent that would cost more than the
        // duplicate read it saves.
        Entry loaded = load(userId);
        if (loaded == null) {
            entries.remove(userId);
            return Optional.empty();
        }

        if (entries.size() >= MAX_ENTRIES) {
            entries.clear();
        }
        entries.put(userId, loaded);
        return Optional.of(loaded);
    }

    /**
     * A short, stable stamp of what this account may do.
     *
     * <p>Sent to the browser on every response as {@code X-Auth-Version} so it
     * can tell, without asking, whether the permissions it is holding are still
     * the ones the server would give it.
     *
     * <p>Derived from the codes themselves rather than from a counter, which is
     * what makes it work with no coordination at all: every node computes the
     * same stamp for the same grants, so a client moving between nodes sees a
     * change only when there genuinely is one. A counter would have to be
     * shared, agreed on, and survive a restart. It is also per-account, so
     * editing one role does not send every signed-in user off to re-read
     * permissions that did not move.
     */
    public String versionFor(long userId) {
        return get(userId).map(Entry::version).orElse("none");
    }

    /** Drops one account's entry. */
    public void evict(long userId) {
        entries.remove(userId);
    }

    /** Drops everything. */
    public void evictAll() {
        entries.clear();
    }

    /**
     * Applies a change made on this node.
     *
     * <p>Ordered first so that the eviction has already happened by the time
     * {@link AuthorityChangeChannel} tells the other nodes about it — a node
     * should never be the last to know about its own change.
     *
     * <p>{@code fallbackExecution} covers a publisher that is not inside a
     * transaction. Without it such an event is dropped silently, which is the
     * worst possible failure mode for an invalidation.
     */
    @Order(0)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onLocalChange(AuthoritiesChanged change) {
        apply(change);
    }

    /**
     * Applies a change that reached this node from another one.
     *
     * <p>A plain {@link EventListener}: the transaction it belongs to committed
     * on a different machine, so there is nothing here to wait for.
     */
    @Order(0)
    @EventListener
    public void onRemoteChange(AuthorityChangeChannel.Received received) {
        apply(received.change());
    }

    private void apply(AuthoritiesChanged change) {
        switch (change) {
            case AuthoritiesChanged.ForUser forUser -> evict(forUser.userId());
            case AuthoritiesChanged.ForEveryone ignored -> evictAll();
        }
    }

    private Entry load(long userId) {
        try {
            User user = userService.get(userId);
            return Entry.of(user, policies.generation());
        } catch (ResourceNotFoundException e) {
            return null;
        }
    }

    /**
     * One account's cached answer.
     *
     * <p>{@code roles} and {@code permissions} repeat what {@code authorities}
     * already contains, and are worth the duplication: the client is told them
     * as two plain lists, while {@code @PreAuthorize} wants one flat collection
     * with roles prefixed. Splitting the flat form back apart at every read
     * would be work done per request to undo work done once.
     *
     * @param canSignIn   whether the account may make requests at all
     * @param authorities what {@code @PreAuthorize} reads, built once
     * @param roles       the role codes, as the client is told them
     * @param permissions the permission codes, sorted, as the client is told them
     * @param roleIds     the role identities, which is what a row-level SCOPE is
     *                    keyed by. Kept here rather than resolved separately
     *                    because this cache has already loaded the whole graph,
     *                    and a second lookup per request to find them would undo
     *                    the point of caching the first
     * @param organizationId where the account sits, or null. An input to a data
     *                    scope, which is why moving somebody between departments
     *                    now has to evict this entry
     * @param departmentId which unit, or null
     * @param reportUnitId đơn vị báo cáo ASXH của tài khoản, hoặc null (tài khoản Sở / UBND).
     *                    Đầu vào của phạm vi phiếu nhập ({@code InputReportRowLevelPolicies}),
     *                    nên đổi đơn vị của tài khoản cũng phải xoá mục này — UserService
     *                    phát {@code AuthoritiesChanged.ForUser} khi trường đó đổi
     * @param version     the stamp described on {@link #versionFor(long)}
     * @param loadedAt    when this was read, for the expiry
     */
    public record Entry(
            boolean canSignIn,
            Collection<GrantedAuthority> authorities,
            List<String> roles,
            List<String> permissions,
            Set<Long> roleIds,
            Long organizationId,
            Long departmentId,
            Long reportUnitId,
            String version,
            long loadedAt) {

        static Entry of(User user, String policyGeneration) {
            // Sorted so the stamp does not depend on the order the database
            // happened to return rows in; two nodes must agree on it.
            List<String> codes = List.copyOf(new TreeSet<>(user.permissionCodes()));
            List<String> roleCodes = List.copyOf(user.roleCodes());

            Collection<GrantedAuthority> granted = new ArrayList<>(codes.size() + roleCodes.size());
            for (String permission : codes) {
                granted.add(new SimpleGrantedAuthority(permission));
            }
            for (String role : roleCodes) {
                granted.add(new SimpleGrantedAuthority("ROLE_" + role));
            }

            Set<Long> roleIds = new TreeSet<>();
            user.getRoles().forEach(role -> roleIds.add(role.getId()));

            // String.hashCode is specified by the language, so it is the same
            // number on every JVM and every node — which is the property this
            // needs and Object.hashCode does not have.
            //
            // The row-level generation is folded in because a policy edit
            // changes what the UI may offer just as surely as a permission does,
            // and this stamp is already on every response. Adding a second
            // header would mean a second thing to expose through CORS and a
            // second silent failure when somebody forgets.
            String stamp = Integer.toHexString(
                    (String.join(",", codes) + "|" + policyGeneration).hashCode());

            return new Entry(
                    user.canSignIn(),
                    List.copyOf(granted),
                    roleCodes,
                    codes,
                    Set.copyOf(roleIds),
                    user.getOrganization() == null ? null : user.getOrganization().getId(),
                    user.getDepartment() == null ? null : user.getDepartment().getId(),
                    user.getReportUnit() == null ? null : user.getReportUnit().getId(),
                    stamp,
                    System.nanoTime());
        }

        boolean isExpired() {
            return System.nanoTime() - loadedAt > TTL.toNanos();
        }
    }
}
