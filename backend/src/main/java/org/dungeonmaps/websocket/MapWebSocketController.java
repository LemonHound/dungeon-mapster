package org.dungeonmaps.websocket;

import org.dungeonmaps.model.MapMembership.MapRole;
import org.dungeonmaps.model.User;
import org.dungeonmaps.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;

@Controller
public class MapWebSocketController {

    private static final Logger log = LoggerFactory.getLogger(MapWebSocketController.class);

    private final SessionRegistry sessionRegistry;
    private final MapCacheService mapCacheService;
    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;

    public MapWebSocketController(SessionRegistry sessionRegistry,
                                  MapCacheService mapCacheService,
                                  SimpMessagingTemplate messagingTemplate,
                                  UserRepository userRepository) {
        this.sessionRegistry = sessionRegistry;
        this.mapCacheService = mapCacheService;
        this.messagingTemplate = messagingTemplate;
        this.userRepository = userRepository;
    }

    @EventListener
    public void onConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs == null) return;

        Long userId = (Long) attrs.get("userId");
        Long mapId = (Long) attrs.get("mapId");
        MapRole role = (MapRole) attrs.get("role");
        String sessionId = accessor.getSessionId();

        if (userId == null || mapId == null || role == null || sessionId == null) return;

        String userName = userRepository.findById(userId)
                .map(User::getName)
                .orElse("Unknown");

        String color = sessionRegistry.assignColor(mapId);
        UserSession session = new UserSession(sessionId, userId, mapId, color, role, userName);
        sessionRegistry.register(session);

        mapCacheService.broadcastPresenceJoined(session);
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        if (sessionId == null) return;

        UserSession session = sessionRegistry.remove(sessionId);
        if (session == null) return;

        mapCacheService.broadcastPresenceLeft(session);
        mapCacheService.evictIfEmpty(session.getMapId());
    }

    @MessageMapping("/map/sync")
    public void handleSync(@Payload Map<String, Object> payload, StompHeaderAccessor accessor) {
        UserSession session = getSession(accessor);
        if (session == null) return;
        String clientId = (String) payload.get("clientId");
        log.debug("Sync requested by session {}, clientId {}", session.getSessionId(), clientId);
        mapCacheService.sendFullState(session, clientId);
    }

    @MessageMapping("/map/selection")
    public void handleSelection(@Payload Map<String, Object> payload, StompHeaderAccessor accessor) {
        UserSession session = getSession(accessor);
        if (session == null) return;

        Map<String, Object> message = Map.of(
                "type", "SELECTION",
                "userId", session.getUserId(),
                "color", session.getColor(),
                "row", payload.get("row"),
                "col", payload.get("col")
        );
        messagingTemplate.convertAndSend("/topic/map/" + session.getMapId(), message);
    }

    @MessageMapping("/map/field-focus")
    public void handleFieldFocus(@Payload Map<String, Object> payload, StompHeaderAccessor accessor) {
        UserSession session = getSession(accessor);
        if (session == null) return;

        Map<String, Object> message = Map.of(
                "type", "FIELD_FOCUS",
                "userId", session.getUserId(),
                "color", session.getColor(),
                "row", payload.get("row"),
                "col", payload.get("col"),
                "field", payload.get("field")
        );
        messagingTemplate.convertAndSend("/topic/map/" + session.getMapId(), message);
    }

    @MessageMapping("/map/field-blur")
    public void handleFieldBlur(StompHeaderAccessor accessor) {
        UserSession session = getSession(accessor);
        if (session == null) return;

        Map<String, Object> message = Map.of(
                "type", "FIELD_BLUR",
                "userId", session.getUserId()
        );
        messagingTemplate.convertAndSend("/topic/map/" + session.getMapId(), message);
    }

    private UserSession getSession(StompHeaderAccessor accessor) {
        String sessionId = accessor.getSessionId();
        if (sessionId == null) return null;
        UserSession session = sessionRegistry.get(sessionId);
        if (session == null) log.warn("No session found for {}", sessionId);
        return session;
    }
}
