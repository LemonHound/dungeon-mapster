package org.dungeonmaps.controller;

import org.dungeonmaps.model.User;
import org.dungeonmaps.repository.UserRepository;
import org.dungeonmaps.security.JwtTokenProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/test")
@ConditionalOnProperty(name = "app.e2e-enabled", havingValue = "true")
public class TestTokenController {

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;

    public TestTokenController(JwtTokenProvider tokenProvider, UserRepository userRepository) {
        this.tokenProvider = tokenProvider;
        this.userRepository = userRepository;
    }

    @PostMapping("/token")
    public ResponseEntity<Map<String, String>> getTestToken() {
        User user = userRepository.findByEmail("e2e@dungeon-mapster.internal")
                .orElseGet(() -> {
                    User u = new User();
                    u.setEmail("e2e@dungeon-mapster.internal");
                    u.setName("E2E Test User");
                    u.setGoogleId("e2e-test-google-id");
                    return userRepository.save(u);
                });
        String token = tokenProvider.generateToken(user.getId(), user.getEmail());
        return ResponseEntity.ok(Map.of("token", token));
    }
}
