package com.dth.frw.module.security.auth.api;

import com.dth.frw.module.security.auth.service.AuthorizationService;
import com.dth.frw.shared.security.CurrentUser;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

/**
 * Stamps every answer with what the caller may currently do.
 *
 * <p>The browser holds a cached copy of its permissions so that hiding a button
 * is a local decision rather than a request. The problem that creates is
 * telling it when that copy stops being right — an administrator can change
 * somebody's role while their dashboard sits open.
 *
 * <p>Rather than open a channel for that, this rides along on traffic the
 * application is already producing: a short header on every response, which the
 * client compares against the one it holds. A dashboard makes a request every
 * few seconds — a navigation, a table, a refetch — so in practice the change
 * lands immediately, at the cost of no extra request, no held connection and no
 * database read. The value comes out of {@code AuthorityCache}, in memory.
 *
 * <p>What it does not cover is a tab left completely idle, which sends nothing
 * and so hears nothing. React Query's refetch-on-focus closes most of that: the
 * moment somebody returns to the tab there is traffic again. A push channel is
 * the honest fix for the rest, and is worth building when there is a second
 * reason to have one.
 *
 * <h2>Why an advice and not an interceptor</h2>
 *
 * <p>A {@code HandlerInterceptor} would have to write the header in
 * {@code preHandle}, because by {@code postHandle} a {@code @RestController}
 * has usually committed the response and a header set then is dropped without a
 * word. But {@code preHandle} runs <em>before</em> the handler — so the one
 * response that matters most, the answer to the request that just changed
 * somebody's roles, would carry the version from before the change.
 *
 * <p>{@link ResponseBodyAdvice} runs after the handler and before the body is
 * written, which is the only window where the value is both current and still
 * settable. By then the service's transaction has committed and the cache has
 * been evicted, so the stamp reflects the change the caller just made.
 */
@RestControllerAdvice
public class AuthVersionAdvice implements ResponseBodyAdvice<Object> {

    /**
     * Must also be listed in {@code WebMvcConfig}'s
     * {@code Access-Control-Expose-Headers}. It is not CORS-safelisted, so
     * without that the browser strips it and this whole mechanism does nothing
     * — with no error anywhere to say so. The same trap {@code X-Total-Count}
     * sets.
     */
    public static final String HEADER = "X-Auth-Version";

    private final AuthorizationService authorizationService;

    public AuthVersionAdvice(AuthorizationService authorizationService) {
        this.authorizationService = authorizationService;
    }

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(Object body,
                                  MethodParameter returnType,
                                  MediaType contentType,
                                  Class<? extends HttpMessageConverter<?>> converterType,
                                  ServerHttpRequest request,
                                  ServerHttpResponse response) {
        // Absent on the open endpoints — signing in has nothing to compare yet,
        // and the login flow reads the permissions straight afterwards anyway.
        CurrentUser.id().ifPresent(id ->
                response.getHeaders().set(HEADER, authorizationService.versionOf(id)));

        // Returned untouched: this advice exists for the header alone.
        return body;
    }
}
