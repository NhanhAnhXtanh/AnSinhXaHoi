package com.dth.frw.module.security.auth.api.dto;

import com.dth.frw.module.security.auth.service.AuthorityCache;
import java.util.List;

/**
 * What the caller may do — as {@code GET /auth/permissions} answers it, and as
 * the live channel pushes it.
 *
 * <p>One shape on both paths, on purpose. The client stores whatever arrives
 * without caring how it got there, so a permission change delivered over the
 * socket and one fetched after a reload leave it in exactly the same state.
 * Two shapes would mean two code paths that have to agree.
 *
 * <p>Its own endpoint rather than fields on the identity, because it is the
 * payload that grows: an application with a few hundred permission codes would
 * otherwise carry all of them inside every access token, on every request.
 *
 * @param roles       the role codes the account holds, for display. Nothing
 *                    authorises on them
 * @param permissions every permission code from every one of those roles,
 *                    flattened, de-duplicated and sorted. This is what the
 *                    access control provider answers {@code can} from
 * @param version     the same stamp the {@code X-Auth-Version} header carries.
 *                    Included in the body so that whichever path delivered this
 *                    also leaves the client's stamp current — without it, a
 *                    push over the socket would update the codes but not the
 *                    stamp, and the very next response's header would look like
 *                    a change and send the client back to re-read what it had
 *                    just been given
 * @param scopedResources the resources whose rows are actually narrowed for this
 *                    account. One field, and it exists to answer one question:
 *                    somebody holding {@code tasks:read} with a narrow data
 *                    scope sees exactly what a system with no data looks like.
 *                    Without this the list screen says "no records" and the
 *                    person has no idea whether that is the truth or a
 *                    permissions problem — a support ticket waiting to be
 *                    raised. Computed from the policy cache, so it costs no
 *                    query
 */
public record AuthoritiesResponse(
        List<String> roles,
        List<String> permissions,
        String version,
        List<String> scopedResources) {

    public static AuthoritiesResponse from(AuthorityCache.Entry entry, List<String> scopedResources) {
        return new AuthoritiesResponse(
                entry.roles(), entry.permissions(), entry.version(), scopedResources);
    }
}
