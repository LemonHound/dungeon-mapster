package org.dungeonmaps.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenProviderTest {

    private static final String SECRET = "test-secret-for-unit-tests-must-be-at-least-32-bytes";
    private static final long EXPIRATION = 86400000L;

    private JwtTokenProvider provider;

    @BeforeEach
    void setUp() {
        provider = new JwtTokenProvider(SECRET, EXPIRATION);
    }

    @Test
    void generateToken_returnsNonBlankToken() {
        String token = provider.generateToken(1L, "user@example.com");
        assertThat(token).isNotBlank();
    }

    @Test
    void validateToken_returnsTrueForValidToken() {
        String token = provider.generateToken(1L, "user@example.com");
        assertThat(provider.validateToken(token)).isTrue();
    }

    @Test
    void validateToken_returnsFalseForGarbage() {
        assertThat(provider.validateToken("not.a.token")).isFalse();
    }

    @Test
    void validateToken_returnsFalseForBlankString() {
        assertThat(provider.validateToken("")).isFalse();
    }

    @Test
    void getUserIdFromToken_roundTrips() {
        String token = provider.generateToken(42L, "user@example.com");
        assertThat(provider.getUserIdFromToken(token)).isEqualTo(42L);
    }

    @Test
    void tokenSignedWithDifferentSecretIsRejected() {
        JwtTokenProvider other = new JwtTokenProvider("different-secret-also-at-least-32-bytes-long", EXPIRATION);
        String token = other.generateToken(1L, "user@example.com");
        assertThat(provider.validateToken(token)).isFalse();
    }

    @Test
    void expiredTokenIsRejected() throws InterruptedException {
        JwtTokenProvider shortLived = new JwtTokenProvider(SECRET, 1L);
        String token = shortLived.generateToken(1L, "user@example.com");
        Thread.sleep(10);
        assertThat(shortLived.validateToken(token)).isFalse();
    }
}
