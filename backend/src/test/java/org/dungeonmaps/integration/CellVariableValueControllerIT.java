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

class CellVariableValueControllerIT extends IntegrationTestBase {

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

    private String dmToken;
    private String playerToken;
    private Long mapId;
    private String variableId;
    private String dmOnlyVariableId;
    private static final int ROW = 1;
    private static final int COL = 1;

    @BeforeEach
    void setUp() throws Exception {
        membershipRepository.deleteAll();
        mapRepository.deleteAll();
        userRepository.deleteAll();

        User dm = new User();
        dm.setEmail("dm@cvv.com");
        dm.setName("DM");
        dm.setGoogleId("google-cvv-dm");
        Long dmId = userRepository.save(dm).getId();
        dmToken = jwtTokenProvider.generateToken(dmId, "dm@cvv.com");

        User player = new User();
        player.setEmail("player@cvv.com");
        player.setName("Player");
        player.setGoogleId("google-cvv-player");
        Long playerId = userRepository.save(player).getId();
        playerToken = jwtTokenProvider.generateToken(playerId, "player@cvv.com");

        String createResponse = mockMvc.perform(post("/api/maps")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "CVV Map", "gridType", "square", "gridSize", 40))))
                .andReturn().getResponse().getContentAsString();

        mapId = objectMapper.readTree(createResponse).get("id").asLong();
        String joinCode = objectMapper.readTree(createResponse).get("joinCode").asText();

        mockMvc.perform(post("/api/maps/join")
                .header("Authorization", "Bearer " + playerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("joinCode", joinCode))));

        String varResponse = mockMvc.perform(post("/api/maps/" + mapId + "/variables")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("name", "HP", "dataType", "TEXT", "visibility", "VISIBLE", "sortOrder", 0))))
                .andReturn().getResponse().getContentAsString();
        variableId = objectMapper.readTree(varResponse).get("id").asText();

        String dmVarResponse = mockMvc.perform(post("/api/maps/" + mapId + "/variables")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("name", "DmOnly", "dataType", "TEXT", "visibility", "DM_ONLY", "sortOrder", 1))))
                .andReturn().getResponse().getContentAsString();
        dmOnlyVariableId = objectMapper.readTree(dmVarResponse).get("id").asText();

        mockMvc.perform(post("/api/grid-cells/" + mapId + "/" + ROW + "/" + COL)
                .header("Authorization", "Bearer " + dmToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("name", "Test Cell"))));
    }

    @Test
    void upsertValue_newValue_createsRecord() throws Exception {
        mockMvc.perform(put("/api/maps/" + mapId + "/cells/" + ROW + "/" + COL + "/variable-values/" + variableId)
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("value", "100"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value("100"));
    }

    @Test
    void upsertValue_existingValue_updatesRecord() throws Exception {
        mockMvc.perform(put("/api/maps/" + mapId + "/cells/" + ROW + "/" + COL + "/variable-values/" + variableId)
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("value", "50"))));

        mockMvc.perform(put("/api/maps/" + mapId + "/cells/" + ROW + "/" + COL + "/variable-values/" + variableId)
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("value", "75"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value("75"));
    }

    @Test
    void deleteValue_removesRecord() throws Exception {
        mockMvc.perform(put("/api/maps/" + mapId + "/cells/" + ROW + "/" + COL + "/variable-values/" + variableId)
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("value", "99"))));

        mockMvc.perform(delete("/api/maps/" + mapId + "/cells/" + ROW + "/" + COL + "/variable-values/" + variableId)
                        .header("Authorization", "Bearer " + dmToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/maps/" + mapId + "/cells/" + ROW + "/" + COL + "/variable-values")
                        .header("Authorization", "Bearer " + dmToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void getValuesForCell_returnsAllValuesForCell() throws Exception {
        mockMvc.perform(put("/api/maps/" + mapId + "/cells/" + ROW + "/" + COL + "/variable-values/" + variableId)
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("value", "42"))));

        mockMvc.perform(get("/api/maps/" + mapId + "/cells/" + ROW + "/" + COL + "/variable-values")
                        .header("Authorization", "Bearer " + dmToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].value").value("42"));
    }

    @Test
    void upsertDmOnlyVariable_asPlayer_returns403() throws Exception {
        mockMvc.perform(put("/api/maps/" + mapId + "/cells/" + ROW + "/" + COL + "/variable-values/" + dmOnlyVariableId)
                        .header("Authorization", "Bearer " + playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("value", "secret"))))
                .andExpect(status().isForbidden());
    }
}
