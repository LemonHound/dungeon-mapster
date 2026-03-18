package org.dungeonmaps.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.dungeonmaps.model.User;
import org.dungeonmaps.repository.DungeonMapRepository;
import org.dungeonmaps.repository.MapMembershipRepository;
import org.dungeonmaps.repository.UserRepository;
import org.dungeonmaps.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MapMembershipIT extends IntegrationTestBase {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DungeonMapRepository mapRepository;

    @Autowired
    private MapMembershipRepository membershipRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private ObjectMapper objectMapper;

    private String ownerToken;
    private Long ownerId;
    private Long mapId;
    private String joinCode;

    @BeforeEach
    void setUp() throws Exception {
        membershipRepository.deleteAll();
        mapRepository.deleteAll();
        userRepository.deleteAll();

        User owner = new User();
        owner.setEmail("owner@example.com");
        owner.setName("Owner");
        owner.setGoogleId("google-owner");
        User savedOwner = userRepository.save(owner);
        ownerId = savedOwner.getId();
        ownerToken = jwtTokenProvider.generateToken(ownerId, "owner@example.com");

        String createResponse = mockMvc.perform(post("/api/maps")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Test Map", "gridType", "square", "gridSize", 40))))
                .andReturn().getResponse().getContentAsString();

        mapId = objectMapper.readTree(createResponse).get("id").asLong();
        joinCode = objectMapper.readTree(createResponse).get("joinCode").asText();
    }

    private String createUserToken(String email, String googleId) {
        User user = new User();
        user.setEmail(email);
        user.setName(email);
        user.setGoogleId(googleId);
        User saved = userRepository.save(user);
        return jwtTokenProvider.generateToken(saved.getId(), email);
    }

    private Long createUserId(String email, String googleId) {
        User user = new User();
        user.setEmail(email);
        user.setName(email);
        user.setGoogleId(googleId);
        return userRepository.save(user).getId();
    }

    @Test
    void joinMap_withValidCode_addsMemberWithPlayerRole() throws Exception {
        String playerToken = createUserToken("player@example.com", "google-player");

        mockMvc.perform(post("/api/maps/join")
                        .header("Authorization", "Bearer " + playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("joinCode", joinCode))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(mapId));

        mockMvc.perform(get("/api/maps/" + mapId + "/members")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.role == 'PLAYER')]").exists());
    }

    @Test
    void joinMap_withInvalidCode_returns404() throws Exception {
        String playerToken = createUserToken("player2@example.com", "google-player2");

        mockMvc.perform(post("/api/maps/join")
                        .header("Authorization", "Bearer " + playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("joinCode", "INVALIDCODE12345"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void joinMap_alreadyMember_returns409() throws Exception {
        String playerToken = createUserToken("player3@example.com", "google-player3");

        mockMvc.perform(post("/api/maps/join")
                        .header("Authorization", "Bearer " + playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("joinCode", joinCode))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/maps/join")
                        .header("Authorization", "Bearer " + playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("joinCode", joinCode))))
                .andExpect(status().isConflict());
    }

    @Test
    void promoteToDm_asOwner_updatesMemberRole() throws Exception {
        String playerToken = createUserToken("player4@example.com", "google-player4");
        Long playerId = userRepository.findByEmail("player4@example.com").get().getId();

        mockMvc.perform(post("/api/maps/join")
                        .header("Authorization", "Bearer " + playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("joinCode", joinCode))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/maps/" + mapId + "/members/" + playerId + "/promote")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/maps/" + mapId + "/members")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.userId == " + playerId + " && @.role == 'DM')]").exists());
    }

    @Test
    void demoteToPlayer_asOwner_updatesMemberRole() throws Exception {
        String dmToken = createUserToken("dm@example.com", "google-dm");
        Long dmId = userRepository.findByEmail("dm@example.com").get().getId();

        mockMvc.perform(post("/api/maps/join")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("joinCode", joinCode))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/maps/" + mapId + "/members/" + dmId + "/promote")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/maps/" + mapId + "/members/" + dmId + "/demote")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/maps/" + mapId + "/members")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.userId == " + dmId + " && @.role == 'PLAYER')]").exists());
    }

    @Test
    void promoteOrDemote_asNonOwner_returns403() throws Exception {
        String playerAToken = createUserToken("playerA@example.com", "google-playerA");
        String playerBToken = createUserToken("playerB@example.com", "google-playerB");
        Long playerBId = userRepository.findByEmail("playerB@example.com").get().getId();

        mockMvc.perform(post("/api/maps/join")
                        .header("Authorization", "Bearer " + playerAToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("joinCode", joinCode))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/maps/join")
                        .header("Authorization", "Bearer " + playerBToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("joinCode", joinCode))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/maps/" + mapId + "/members/" + playerBId + "/promote")
                        .header("Authorization", "Bearer " + playerAToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void transferOwnership_asOwner_previousOwnerBecomesDm() throws Exception {
        String dmToken = createUserToken("newowner@example.com", "google-newowner");
        Long newOwnerId = userRepository.findByEmail("newowner@example.com").get().getId();

        mockMvc.perform(post("/api/maps/join")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("joinCode", joinCode))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/maps/" + mapId + "/members/" + newOwnerId + "/promote")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/maps/" + mapId + "/transfer")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("targetUserId", newOwnerId))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/maps/" + mapId + "/members")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(jsonPath("$[?(@.userId == " + ownerId + " && @.role == 'DM')]").exists())
                .andExpect(jsonPath("$[?(@.userId == " + newOwnerId + " && @.role == 'OWNER')]").exists());
    }

    @Test
    void removeMember_asOwner_removesMembership() throws Exception {
        String playerToken = createUserToken("removeme@example.com", "google-removeme");
        Long playerId = userRepository.findByEmail("removeme@example.com").get().getId();

        mockMvc.perform(post("/api/maps/join")
                        .header("Authorization", "Bearer " + playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("joinCode", joinCode))))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/maps/" + mapId + "/members/" + playerId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk());

        assertThat(membershipRepository.findByMapIdAndUserId(mapId, playerId)).isEmpty();
    }

    @Test
    void removedMember_getMap_returns404() throws Exception {
        String playerToken = createUserToken("removed2@example.com", "google-removed2");
        Long playerId = userRepository.findByEmail("removed2@example.com").get().getId();

        mockMvc.perform(post("/api/maps/join")
                        .header("Authorization", "Bearer " + playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("joinCode", joinCode))))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/maps/" + mapId + "/members/" + playerId)
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/maps/" + mapId)
                        .header("Authorization", "Bearer " + playerToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void getMembers_returnsAllMembersWithCorrectRoles() throws Exception {
        String p1Token = createUserToken("mem1@example.com", "google-mem1");
        String p2Token = createUserToken("mem2@example.com", "google-mem2");

        mockMvc.perform(post("/api/maps/join")
                        .header("Authorization", "Bearer " + p1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("joinCode", joinCode))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/maps/join")
                        .header("Authorization", "Bearer " + p2Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("joinCode", joinCode))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/maps/" + mapId + "/members")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[?(@.role == 'OWNER')]").exists())
                .andExpect(jsonPath("$[?(@.role == 'PLAYER')]").isArray());
    }
}
