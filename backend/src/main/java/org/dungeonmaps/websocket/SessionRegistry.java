package org.dungeonmaps.websocket;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SessionRegistry {

    private static final String[] COLORS = {
            "Red", "Blue", "Green", "Purple", "Orange", "Teal", "Pink", "Amber"
    };

    private final ConcurrentHashMap<String, UserSession> sessions = new ConcurrentHashMap<>();

    public void register(UserSession session) {
        sessions.put(session.getSessionId(), session);
    }

    public UserSession get(String sessionId) {
        return sessions.get(sessionId);
    }

    public UserSession remove(String sessionId) {
        return sessions.remove(sessionId);
    }

    public List<UserSession> getSessionsForMap(Long mapId) {
        return sessions.values().stream()
                .filter(s -> s.getMapId().equals(mapId))
                .toList();
    }

    public boolean hasActiveSessionsForMap(Long mapId) {
        return sessions.values().stream().anyMatch(s -> s.getMapId().equals(mapId));
    }

    public String assignColor(Long mapId) {
        List<String> usedColors = getSessionsForMap(mapId).stream()
                .map(UserSession::getColor)
                .toList();

        for (String color : COLORS) {
            if (!usedColors.contains(color)) return color;
        }
        return COLORS[usedColors.size() % COLORS.length];
    }
}
