package com.dth.frw.module.security.auth.service;

import java.util.Collection;
import java.util.Optional;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.stereotype.Service;

/**
 * Turns the identity in an access token into the authorities
 * {@code @PreAuthorize} reads.
 *
 * <p>This is the half of authorisation that used to live in the token itself.
 * Moving it out is what keeps the token a constant few hundred bytes however
 * large the permission model grows; keeping the answer in
 * {@link AuthorityCache} rather than in the database is what stops that costing
 * a query per request.
 *
 * <p>The result is that neither cost is paid. Nothing is carried in the token,
 * and nothing is read per request — but because the cache is invalidated by the
 * features that change the data, rather than expiring on a timer, a permission
 * revoked is a permission gone on the very next request.
 *
 * <p>It lives in the {@code auth} slice and reaches the user feature through
 * {@code UserService}, never its repository — the same rule every other slice
 * follows.
 */
@Service
public class AuthorizationService {

    private final AuthorityCache cache;

    public AuthorizationService(AuthorityCache cache) {
        this.cache = cache;
    }

    /**
     * The authorities the account behind {@code subject} currently holds.
     *
     * <p>Permission codes become authorities verbatim, so a rule reads
     * {@code hasAuthority("users:write")}. Role codes are also granted, with the
     * {@code ROLE_} prefix Spring Security's {@code hasRole} expects — not
     * because anything checks a role today, but because a rule that legitimately
     * wants to (an emergency break-glass endpoint, say) should not have to
     * invent its own convention.
     *
     * @param subject the token's {@code sub} claim, which this application
     *                always writes as the user id
     * @throws InvalidBearerTokenException when the token names an account that
     *                                     cannot make requests any more — one
     *                                     that was deleted or disabled while the
     *                                     session was open. A 401 rather than a
     *                                     403, because the right answer is for
     *                                     the client to stop using the token,
     *                                     not to ask for something else
     */
    public Collection<GrantedAuthority> authoritiesOf(String subject) {
        AuthorityCache.Entry entry = cache.get(parse(subject))
                .orElseThrow(() -> new InvalidBearerTokenException("This account no longer exists"));

        if (!entry.canSignIn()) {
            // Previously this could only be caught at the next refresh, so a
            // disabled account kept working for the rest of the access token's
            // life. Resolving authorities per request is what closes that.
            throw new InvalidBearerTokenException("This account is no longer active");
        }
        return entry.authorities();
    }

    /**
     * The stamp of the caller's current grants, for the {@code X-Auth-Version}
     * response header.
     *
     * @see AuthorityCache#versionFor(long)
     */
    public String versionOf(long userId) {
        return cache.versionFor(userId);
    }

    /**
     * What an account may do, in the shape the client stores.
     *
     * <p>Served from the cache, so {@code GET /auth/permissions} costs no
     * database read either — it used to resolve the user a second time, once in
     * the converter that authenticated the request and once again to build the
     * answer.
     */
    public Optional<AuthorityCache.Entry> entryOf(long userId) {
        return cache.get(userId);
    }

    /**
     * Whether an account holds a permission right now — asked, and answered,
     * without a request in flight.
     *
     * <p>This is what makes a long-lived WebSocket safe. A connection opened
     * hours ago carries a {@code Principal} from whenever it was opened, so
     * nothing may be delivered on the strength of that alone; every outbound
     * message re-asks here instead. It is a memory read, which is the only
     * reason a check per message rather than per request is affordable.
     *
     * <p>Returns {@code false} rather than throwing for an account that is
     * disabled, deleted or simply unknown. The caller is a delivery path, not a
     * request: there is nobody to return an error to, and the right behaviour is
     * to send nothing.
     */
    public boolean has(long userId, String permission) {
        return cache.get(userId)
                .filter(AuthorityCache.Entry::canSignIn)
                .filter(entry -> entry.authorities().stream()
                        .anyMatch(granted -> permission.equals(granted.getAuthority())))
                .isPresent();
    }

    private static long parse(String subject) {
        try {
            return Long.parseLong(subject);
        } catch (NumberFormatException e) {
            // A valid signature over a subject that is not a user id means the
            // signing key is being used by something that is not this
            // application. Nothing sensible can be authorised from it.
            throw new InvalidBearerTokenException("Malformed access token");
        }
    }
}
