package org.dungeonmaps.websocket;

import org.dungeonmaps.model.MapMembership.MapRole;

import java.time.Instant;

public class UserSession {

    private final String sessionId;
    private final Long userId;
    private final Long mapId;
    private final String color;
    private final MapRole role;
    private final String userName;
    private final Instant connectedAt;
    private volatile Instant lastHeartbeat;

    public UserSession(String sessionId, Long userId, Long mapId, String color, MapRole role, String userName) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.mapId = mapId;
        this.color = color;
        this.role = role;
        this.userName = userName;
        this.connectedAt = Instant.now();
        this.lastHeartbeat = Instant.now();
    }

    public String getSessionId() {
        return sessionId;
    }

    public Long getUserId() {
        return userId;
    }

    public Long getMapId() {
        return mapId;
    }

    public String getColor() {
        return color;
    }

    public MapRole getRole() {
        return role;
    }

    public String getUserName() {
        return userName;
    }

    public Instant getConnectedAt() {
        return connectedAt;
    }

    public Instant getLastHeartbeat() {
        return lastHeartbeat;
    }

    public void updateHeartbeat() {
        this.lastHeartbeat = Instant.now();
    }
}
