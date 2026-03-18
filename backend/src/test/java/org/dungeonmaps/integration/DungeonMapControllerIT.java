package org.dungeonmaps.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.dungeonmaps.model.DungeonMap;
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

class DungeonMapControllerIT extends IntegrationTestBase {

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

    private String token;
    private Long userId;

    @BeforeEach
    void setUp() {
        membershipRepository.deleteAll();
        mapRepository.deleteAll();
        userRepository.deleteAll();

        User user = new User();
        user.setEmail("test@example.com");
        user.setName("Test User");
        user.setGoogleId("google-id-123");
        User saved = userRepository.save(user);
        userId = saved.getId();
        token = jwtTokenProvider.generateToken(userId, "test@example.com");
    }

    @Test
    void createMap_returnsCreatedMap() throws Exception {
        Map<String, Object> body = Map.of("name", "My Test Map", "gridType", "square", "gridSize", 40);

        mockMvc.perform(post("/api/maps")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("My Test Map"))
                .andExpect(jsonPath("$.joinCode").isNotEmpty());
    }

    @Test
    void getMaps_returnsUserMaps() throws Exception {
        mockMvc.perform(post("/api/maps")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("name", "Map A", "gridType", "square", "gridSize", 40))));

        mockMvc.perform(get("/api/maps")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Map A"));
    }

    @Test
    void deleteMap_removesMap() throws Exception {
        String createResponse = mockMvc.perform(post("/api/maps")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "To Delete", "gridType", "square", "gridSize", 40))))
                .andReturn().getResponse().getContentAsString();

        Long mapId = objectMapper.readTree(createResponse).get("id").asLong();

        mockMvc.perform(delete("/api/maps/" + mapId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        assertThat(mapRepository.findById(mapId)).isEmpty();
    }

    @Test
    void patchMap_updatesField() throws Exception {
        String createResponse = mockMvc.perform(post("/api/maps")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Original", "gridType", "square", "gridSize", 40))))
                .andReturn().getResponse().getContentAsString();

        Long mapId = objectMapper.readTree(createResponse).get("id").asLong();

        mockMvc.perform(patch("/api/maps/" + mapId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("field", "name", "value", "Renamed"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed"));
    }

    @Test
    void getMapById_returnsCorrectMap() throws Exception {
        String createResponse = mockMvc.perform(post("/api/maps")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Find Me", "gridType", "square", "gridSize", 40))))
                .andReturn().getResponse().getContentAsString();

        Long mapId = objectMapper.readTree(createResponse).get("id").asLong();

        mockMvc.perform(get("/api/maps/" + mapId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Find Me"))
                .andExpect(jsonPath("$.id").value(mapId));
    }

    @Test
    void getMapById_notFound_returns404() throws Exception {
        mockMvc.perform(get("/api/maps/999999")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateMap_asOwner_persistsName() throws Exception {
        String createResponse = mockMvc.perform(post("/api/maps")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Before Update", "gridType", "square", "gridSize", 40))))
                .andReturn().getResponse().getContentAsString();

        Long mapId = objectMapper.readTree(createResponse).get("id").asLong();
        String joinCode = objectMapper.readTree(createResponse).get("joinCode").asText();

        Map<String, Object> update = Map.of("name", "After Update", "gridType", "square", "gridSize", 40,
                "gridOffsetX", 0.0, "gridOffsetY", 0.0, "gridRotation", 0.0, "gridScale", 1.0,
                "mapOffsetX", 0.0, "mapOffsetY", 0.0, "mapScale", 1.0);

        mockMvc.perform(put("/api/maps/" + mapId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("After Update"));
    }

    @Test
    void deleteMap_asOwner_removesMapAndMemberships() throws Exception {
        String createResponse = mockMvc.perform(post("/api/maps")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "To Delete", "gridType", "square", "gridSize", 40))))
                .andReturn().getResponse().getContentAsString();

        Long mapId = objectMapper.readTree(createResponse).get("id").asLong();

        mockMvc.perform(delete("/api/maps/" + mapId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        assertThat(mapRepository.findById(mapId)).isEmpty();
        assertThat(membershipRepository.findByMapId(mapId)).isEmpty();
    }

    @Test
    void deleteMap_asNonOwner_returns403() throws Exception {
        String createResponse = mockMvc.perform(post("/api/maps")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Owner Map", "gridType", "square", "gridSize", 40))))
                .andReturn().getResponse().getContentAsString();

        Long mapId = objectMapper.readTree(createResponse).get("id").asLong();

        User other = new User();
        other.setEmail("other@example.com");
        other.setName("Other");
        other.setGoogleId("google-other");
        Long otherId = userRepository.save(other).getId();
        String otherToken = jwtTokenProvider.generateToken(otherId, "other@example.com");

        mockMvc.perform(delete("/api/maps/" + mapId)
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void getMap_withoutAuth_returns401() throws Exception {
        mockMvc.perform(get("/api/maps"))
                .andExpect(status().isUnauthorized());
    }
}
