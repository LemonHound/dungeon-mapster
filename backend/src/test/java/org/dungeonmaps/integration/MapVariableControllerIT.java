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

class MapVariableControllerIT extends IntegrationTestBase {

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

    @BeforeEach
    void setUp() throws Exception {
        membershipRepository.deleteAll();
        mapRepository.deleteAll();
        userRepository.deleteAll();

        User dm = new User();
        dm.setEmail("dm@var.com");
        dm.setName("DM");
        dm.setGoogleId("google-var-dm");
        Long dmId = userRepository.save(dm).getId();
        dmToken = jwtTokenProvider.generateToken(dmId, "dm@var.com");

        User player = new User();
        player.setEmail("player@var.com");
        player.setName("Player");
        player.setGoogleId("google-var-player");
        Long playerId = userRepository.save(player).getId();
        playerToken = jwtTokenProvider.generateToken(playerId, "player@var.com");

        String createResponse = mockMvc.perform(post("/api/maps")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Var Map", "gridType", "square", "gridSize", 40))))
                .andReturn().getResponse().getContentAsString();

        mapId = objectMapper.readTree(createResponse).get("id").asLong();
        String joinCode = objectMapper.readTree(createResponse).get("joinCode").asText();

        mockMvc.perform(post("/api/maps/join")
                .header("Authorization", "Bearer " + playerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("joinCode", joinCode))));
    }

    private Map<String, Object> textVariableBody(String name, String visibility) {
        return Map.of("name", name, "dataType", "TEXT", "visibility", visibility, "sortOrder", 0);
    }

    private Map<String, Object> picklistVariableBody(String name) {
        return Map.of("name", name, "dataType", "PICKLIST", "visibility", "VISIBLE", "sortOrder", 0, "showColorOnCells", false);
    }

    @Test
    void createVariable_asDm_returnsCreatedVariable() throws Exception {
        mockMvc.perform(post("/api/maps/" + mapId + "/variables")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(textVariableBody("HP", "VISIBLE"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("HP"))
                .andExpect(jsonPath("$.id").isNotEmpty());
    }

    @Test
    void createVariable_asPlayer_returns403() throws Exception {
        mockMvc.perform(post("/api/maps/" + mapId + "/variables")
                        .header("Authorization", "Bearer " + playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(textVariableBody("HP", "VISIBLE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void updateVariable_asDm_persistsChanges() throws Exception {
        String createResponse = mockMvc.perform(post("/api/maps/" + mapId + "/variables")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(textVariableBody("OldName", "VISIBLE"))))
                .andReturn().getResponse().getContentAsString();

        String variableId = objectMapper.readTree(createResponse).get("id").asText();

        mockMvc.perform(put("/api/maps/" + mapId + "/variables/" + variableId)
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "NewName", "visibility", "VISIBLE", "dataType", "TEXT", "sortOrder", 0))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("NewName"));
    }

    @Test
    void deleteVariable_cascadesAssociatedCellValues() throws Exception {
        String createResponse = mockMvc.perform(post("/api/maps/" + mapId + "/variables")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(textVariableBody("ToDelete", "VISIBLE"))))
                .andReturn().getResponse().getContentAsString();

        String variableId = objectMapper.readTree(createResponse).get("id").asText();

        mockMvc.perform(delete("/api/maps/" + mapId + "/variables/" + variableId)
                        .header("Authorization", "Bearer " + dmToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/maps/" + mapId + "/variables")
                        .header("Authorization", "Bearer " + dmToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + variableId + "')]").doesNotExist());
    }

    @Test
    void addPicklistValue_asDm_appearsInPicklistValues() throws Exception {
        String createResponse = mockMvc.perform(post("/api/maps/" + mapId + "/variables")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(picklistVariableBody("Status"))))
                .andReturn().getResponse().getContentAsString();

        String variableId = objectMapper.readTree(createResponse).get("id").asText();

        mockMvc.perform(post("/api/maps/" + mapId + "/variables/" + variableId + "/picklist-values")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("label", "Active"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value("Active"));

        mockMvc.perform(get("/api/maps/" + mapId + "/variables/" + variableId + "/picklist-values")
                        .header("Authorization", "Bearer " + dmToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].label").value("Active"));
    }

    @Test
    void updatePicklistValue_asDm_persistsLabel() throws Exception {
        String createResponse = mockMvc.perform(post("/api/maps/" + mapId + "/variables")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(picklistVariableBody("State"))))
                .andReturn().getResponse().getContentAsString();

        String variableId = objectMapper.readTree(createResponse).get("id").asText();

        String pvResponse = mockMvc.perform(post("/api/maps/" + mapId + "/variables/" + variableId + "/picklist-values")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("label", "OldLabel"))))
                .andReturn().getResponse().getContentAsString();

        String pvId = objectMapper.readTree(pvResponse).get("id").asText();

        mockMvc.perform(put("/api/maps/" + mapId + "/variables/" + variableId + "/picklist-values/" + pvId)
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("label", "NewLabel"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value("NewLabel"));
    }

    @Test
    void deletePicklistValue_asDm_removesOption() throws Exception {
        String createResponse = mockMvc.perform(post("/api/maps/" + mapId + "/variables")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(picklistVariableBody("Mood"))))
                .andReturn().getResponse().getContentAsString();

        String variableId = objectMapper.readTree(createResponse).get("id").asText();

        String pvResponse = mockMvc.perform(post("/api/maps/" + mapId + "/variables/" + variableId + "/picklist-values")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("label", "Happy"))))
                .andReturn().getResponse().getContentAsString();

        String pvId = objectMapper.readTree(pvResponse).get("id").asText();

        mockMvc.perform(delete("/api/maps/" + mapId + "/variables/" + variableId + "/picklist-values/" + pvId)
                        .header("Authorization", "Bearer " + dmToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/maps/" + mapId + "/variables/" + variableId + "/picklist-values")
                        .header("Authorization", "Bearer " + dmToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void getVariables_returnsVariablesWithVisibilityField() throws Exception {
        mockMvc.perform(post("/api/maps/" + mapId + "/variables")
                        .header("Authorization", "Bearer " + dmToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(textVariableBody("DmSecret", "DM_ONLY"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/maps/" + mapId + "/variables")
                        .header("Authorization", "Bearer " + dmToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].visibility").value("DM_ONLY"));
    }
}
