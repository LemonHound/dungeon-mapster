package org.dungeonmaps.websocket;

import org.dungeonmaps.model.MapMembership.MapRole;
import org.dungeonmaps.service.DungeonMapService;
import org.dungeonmaps.security.JwtTokenProvider;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Component
public class WebSocketHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtTokenProvider jwtTokenProvider;
    private final DungeonMapService dungeonMapService;

    public WebSocketHandshakeInterceptor(JwtTokenProvider jwtTokenProvider,
                                         DungeonMapService dungeonMapService) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.dungeonMapService = dungeonMapService;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String query = request.getURI().getQuery();
        if (query == null) return false;

        String token = null;
        Long mapId = null;

        for (String param : query.split("&")) {
            String[] kv = param.split("=", 2);
            if (kv.length != 2) continue;
            if ("token".equals(kv[0])) token = kv[1];
            if ("mapId".equals(kv[0])) {
                try {
                    mapId = Long.parseLong(kv[1]);
                } catch (NumberFormatException ignored) {
                }
            }
        }

        if (!StringUtils.hasText(token) || mapId == null) return false;
        if (!jwtTokenProvider.validateToken(token)) return false;

        Long userId = jwtTokenProvider.getUserIdFromToken(token);

        MapRole role = dungeonMapService.getMembership(mapId, userId)
                .map(m -> m.getRole())
                .orElse(null);

        if (role == null) return false;

        attributes.put("userId", userId);
        attributes.put("mapId", mapId);
        attributes.put("role", role);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
    }
}
