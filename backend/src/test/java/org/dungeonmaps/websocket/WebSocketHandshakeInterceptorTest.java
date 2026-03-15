package org.dungeonmaps.websocket;

import org.dungeonmaps.model.MapMembership;
import org.dungeonmaps.model.MapMembership.MapRole;
import org.dungeonmaps.security.JwtTokenProvider;
import org.dungeonmaps.service.DungeonMapService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.http.server.ServletServerHttpRequest;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WebSocketHandshakeInterceptorTest {

    private static final String SECRET = "test-secret-for-unit-tests-must-be-at-least-32-bytes";

    @Mock
    private DungeonMapService dungeonMapService;

    private JwtTokenProvider jwtTokenProvider;
    private WebSocketHandshakeInterceptor interceptor;

    @BeforeEach
    void setUp() {
        jwtTokenProvider = new JwtTokenProvider(SECRET, 86400000L);
        interceptor = new WebSocketHandshakeInterceptor(jwtTokenProvider, dungeonMapService);
    }

    private ServletServerHttpRequest requestWithQuery(String query) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/ws");
        request.setQueryString(query);
        return new ServletServerHttpRequest(request);
    }

    private MapMembership membership(MapRole role) {
        MapMembership m = new MapMembership();
        m.setRole(role);
        return m;
    }

    @Test
    void validTokenAndMembership_allowsHandshake() throws Exception {
        String token = jwtTokenProvider.generateToken(1L, "user@example.com");
        when(dungeonMapService.getMembership(10L, 1L)).thenReturn(Optional.of(membership(MapRole.PLAYER)));

        Map<String, Object> attrs = new HashMap<>();
        boolean result = interceptor.beforeHandshake(
                requestWithQuery("token=" + token + "&mapId=10"), null, null, attrs);

        assertThat(result).isTrue();
        assertThat(attrs.get("userId")).isEqualTo(1L);
        assertThat(attrs.get("mapId")).isEqualTo(10L);
        assertThat(attrs.get("role")).isEqualTo(MapRole.PLAYER);
    }

    @Test
    void missingToken_rejectsHandshake() throws Exception {
        Map<String, Object> attrs = new HashMap<>();
        boolean result = interceptor.beforeHandshake(
                requestWithQuery("mapId=10"), null, null, attrs);
        assertThat(result).isFalse();
    }

    @Test
    void missingMapId_rejectsHandshake() throws Exception {
        String token = jwtTokenProvider.generateToken(1L, "user@example.com");
        Map<String, Object> attrs = new HashMap<>();
        boolean result = interceptor.beforeHandshake(
                requestWithQuery("token=" + token), null, null, attrs);
        assertThat(result).isFalse();
    }

    @Test
    void invalidToken_rejectsHandshake() throws Exception {
        Map<String, Object> attrs = new HashMap<>();
        boolean result = interceptor.beforeHandshake(
                requestWithQuery("token=not.valid.token&mapId=10"), null, null, attrs);
        assertThat(result).isFalse();
    }

    @Test
    void nonMember_rejectsHandshake() throws Exception {
        String token = jwtTokenProvider.generateToken(1L, "user@example.com");
        when(dungeonMapService.getMembership(10L, 1L)).thenReturn(Optional.empty());

        Map<String, Object> attrs = new HashMap<>();
        boolean result = interceptor.beforeHandshake(
                requestWithQuery("token=" + token + "&mapId=10"), null, null, attrs);
        assertThat(result).isFalse();
    }

    @Test
    void nonNumericMapId_rejectsHandshake() throws Exception {
        String token = jwtTokenProvider.generateToken(1L, "user@example.com");
        Map<String, Object> attrs = new HashMap<>();
        boolean result = interceptor.beforeHandshake(
                requestWithQuery("token=" + token + "&mapId=abc"), null, null, attrs);
        assertThat(result).isFalse();
    }
}
