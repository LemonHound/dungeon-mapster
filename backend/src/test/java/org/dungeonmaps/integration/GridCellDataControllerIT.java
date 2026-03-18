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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class GridCellDataControllerIT extends IntegrationTestBase {

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
    private Long mapId;

    @BeforeEach
    void setUp() throws Exception {
        membershipRepository.deleteAll();
        mapRepository.deleteAll();
        userRepository.deleteAll();

        User user = new User();
        user.setEmail("grid@example.com");
        user.setName("Grid User");
        user.setGoogleId("google-grid");
        Long userId = userRepository.save(user).getId();
        token = jwtTokenProvider.generateToken(userId, "grid@example.com");

        String createResponse = mockMvc.perform(post("/api/maps")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Grid Map", "gridType", "square", "gridSize", 40))))
                .andReturn().getResponse().getContentAsString();

        mapId = objectMapper.readTree(createResponse).get("id").asLong();
    }

    @Test
    void saveCell_andRetrieve_returnsCorrectData() throws Exception {
        mockMvc.perform(post("/api/grid-cells/" + mapId + "/1/2")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Cave Entrance"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Cave Entrance"))
                .andExpect(jsonPath("$.rowIndex").value(1))
                .andExpect(jsonPath("$.colIndex").value(2));

        mockMvc.perform(get("/api/grid-cells/" + mapId + "/1/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Cave Entrance"));
    }

    @Test
    void ensureCell_createsNewCellIfNotExists() throws Exception {
        mockMvc.perform(post("/api/grid-cells/" + mapId + "/3/4/ensure")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rowIndex").value(3))
                .andExpect(jsonPath("$.colIndex").value(4));
    }

    @Test
    void ensureCell_returnsExistingCell_withoutCreatingDuplicate() throws Exception {
        mockMvc.perform(post("/api/grid-cells/" + mapId + "/5/6")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Named Cell"))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/grid-cells/" + mapId + "/5/6/ensure")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Named Cell"));
    }
}
