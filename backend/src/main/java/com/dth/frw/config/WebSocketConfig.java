package com.dth.frw.config;

import com.dth.frw.module.security.auth.api.StompAuthChannelInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * The live channel: STOMP over WebSocket at {@code /ws}.
 *
 * <p>Built for notifications, and deliberately not for permissions —
 * {@code X-Auth-Version} already carries those on ordinary traffic for no extra
 * connection. What this exists for is the class of thing an HTTP response
 * cannot carry, because the server has something to say when the client was not
 * asking: a notification arriving, a job's progress, another person opening the
 * record you are editing.
 *
 * <h2>Server to client only, for now</h2>
 *
 * <p>No {@code @MessageMapping} anywhere: nothing is accepted <em>from</em> a
 * client. That is not a limitation of the transport but a decision about
 * surface area — every inbound destination is an endpoint to authorise, and
 * none of the features built so far needs one. Presence and record locking will,
 * and they are the reason this is WebSocket rather than Server-Sent Events,
 * which cannot carry the client half at all.
 *
 * <h2>The broker is in memory, so this is single-node</h2>
 *
 * <p>{@code enableSimpleBroker} keeps subscriptions in this JVM. A notification
 * raised on one node reaches a client connected to another because
 * {@code NotificationPublisher} fans out over {@link
 * com.dth.frw.shared.messaging.PostgresEventBus} and each node delivers to its
 * own sessions — so user-targeted messages are already correct across nodes.
 * What is <em>not</em> correct across nodes is a broadcast {@code /topic}, which
 * only reaches subscribers on the node that sent it. Adding one means either
 * fanning it out the same way or switching to a broker relay
 * ({@code enableStompBrokerRelay}) with RabbitMQ behind it.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /**
     * The handshake path.
     *
     * <p>Behind a reverse proxy this needs the upgrade headers passed through —
     * in nginx, {@code proxy_set_header Upgrade $http_upgrade} and
     * {@code proxy_set_header Connection "upgrade"}. Without them everything
     * works locally and nothing works in production, which is the classic way
     * to lose an afternoon.
     */
    public static final String ENDPOINT = "/ws";

    private final String[] allowedOrigins;
    private final StompAuthChannelInterceptor authInterceptor;

    public WebSocketConfig(@Value("${app.cors.allowed-origins}") String[] allowedOrigins,
                           StompAuthChannelInterceptor authInterceptor) {
        this.allowedOrigins = allowedOrigins;
        this.authInterceptor = authInterceptor;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // The same origins the REST API allows, from the same property. A
        // WebSocket handshake is not subject to the CORS rules the browser
        // applies to fetch, so this list is the only thing checking it.
        registry.addEndpoint(ENDPOINT).setAllowedOrigins(allowedOrigins);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // /user/** is Spring's per-session destination prefix: a client
        // subscribes to /user/queue/notifications and the broker resolves that
        // to its own session, so one client cannot subscribe to another's
        // messages by guessing a name. /topic is registered for the broadcast
        // features on the roadmap.
        registry.enableSimpleBroker("/queue", "/topic");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Everything a client sends passes through here: CONNECT, SUBSCRIBE and
        // (were there any) SEND. It is the only place authentication and
        // authorisation happen on this channel — the servlet filter chain ran
        // once, at the handshake, and has no idea what frames follow.
        registration.interceptors(authInterceptor);
    }
}
