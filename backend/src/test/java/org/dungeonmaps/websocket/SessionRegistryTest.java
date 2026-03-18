package org.dungeonmaps.websocket;

import org.dungeonmaps.model.MapMembership.MapRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SessionRegistryTest {

    private SessionRegistry registry;

    @BeforeEach
    void setUp() {
        registry = new SessionRegistry();
    }

    private UserSession session(String sessionId, Long userId, Long mapId, MapRole role, String color) {
        return new UserSession(sessionId, userId, mapId, color, role, "User " + userId);
    }

    @Test
    void registerAndGet_returnsSession() {
        UserSession s = session("s1", 1L, 10L, MapRole.OWNER, "Red");
        registry.register(s);
        assertThat(registry.get("s1")).isSameAs(s);
    }

    @Test
    void remove_deletesAndReturnsSession() {
        UserSession s = session("s1", 1L, 10L, MapRole.PLAYER, "Red");
        registry.register(s);
        assertThat(registry.remove("s1")).isSameAs(s);
        assertThat(registry.get("s1")).isNull();
    }

    @Test
    void getSessionsForMap_filtersCorrectly() {
        registry.register(session("s1", 1L, 10L, MapRole.OWNER, "Red"));
        registry.register(session("s2", 2L, 10L, MapRole.PLAYER, "Blue"));
        registry.register(session("s3", 3L, 99L, MapRole.DM, "Green"));

        List<UserSession> result = registry.getSessionsForMap(10L);
        assertThat(result).hasSize(2);
        assertThat(result).extracting(UserSession::getSessionId).containsExactlyInAnyOrder("s1", "s2");
    }

    @Test
    void hasActiveSessionsForMap_trueWhenPresent() {
        registry.register(session("s1", 1L, 10L, MapRole.PLAYER, "Red"));
        assertThat(registry.hasActiveSessionsForMap(10L)).isTrue();
        assertThat(registry.hasActiveSessionsForMap(99L)).isFalse();
    }

    @Test
    void assignColor_returnsFirstUnused() {
        registry.register(session("s1", 1L, 10L, MapRole.OWNER, "Red"));
        String color = registry.assignColor(10L);
        assertThat(color).isEqualTo("Blue");
    }

    @Test
    void getUsersForMap_returnsAllConnectedUserIds() {
        registry.register(session("s1", 10L, 42L, MapRole.OWNER, "Red"));
        registry.register(session("s2", 20L, 42L, MapRole.PLAYER, "Blue"));
        registry.register(session("s3", 30L, 99L, MapRole.DM, "Green"));

        List<UserSession> result = registry.getSessionsForMap(42L);
        assertThat(result).extracting(UserSession::getUserId).containsExactlyInAnyOrder(10L, 20L);
    }

    @Test
    void assignColor_wrapsAroundWhenAllColorsUsed() {
        String[] colors = {"Red", "Blue", "Green", "Purple", "Orange", "Teal", "Pink", "Amber"};
        for (int i = 0; i < colors.length; i++) {
            registry.register(session("s" + i, (long) i, 10L, MapRole.PLAYER, colors[i]));
        }
        String color = registry.assignColor(10L);
        assertThat(color).isEqualTo("Red");
    }
}
