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

class NoteControllerIT extends IntegrationTestBase {

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
    private String memberToken;
    private Long mapId;
    private String joinCode;

    @BeforeEach
    void setUp() throws Exception {
        membershipRepository.deleteAll();
        mapRepository.deleteAll();
        userRepository.deleteAll();

        User owner = new User();
        owner.setEmail("owner@notes.com");
        owner.setName("Owner");
        owner.setGoogleId("google-notes-owner");
        Long ownerId = userRepository.save(owner).getId();
        ownerToken = jwtTokenProvider.generateToken(ownerId, "owner@notes.com");

        User member = new User();
        member.setEmail("member@notes.com");
        member.setName("Member");
        member.setGoogleId("google-notes-member");
        Long memberId = userRepository.save(member).getId();
        memberToken = jwtTokenProvider.generateToken(memberId, "member@notes.com");

        String createResponse = mockMvc.perform(post("/api/maps")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Notes Map", "gridType", "square", "gridSize", 40))))
                .andReturn().getResponse().getContentAsString();

        mapId = objectMapper.readTree(createResponse).get("id").asLong();
        joinCode = objectMapper.readTree(createResponse).get("joinCode").asText();

        mockMvc.perform(post("/api/maps/join")
                .header("Authorization", "Bearer " + memberToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("joinCode", joinCode))));
    }

    @Test
    void saveSharedCellNote_retrievableByDifferentMember() throws Exception {
        mockMvc.perform(put("/api/maps/" + mapId + "/notes/cell/1/1/shared")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("content", "Shared cave note"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/maps/" + mapId + "/notes/cell/1/1")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sharedContent").value("Shared cave note"));
    }

    @Test
    void savePrivateCellNote_notReturnedForOtherUser() throws Exception {
        mockMvc.perform(put("/api/maps/" + mapId + "/notes/cell/2/2/private")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("content", "Owner secret"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/maps/" + mapId + "/notes/cell/2/2")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myPrivateContent").isEmpty());
    }

    @Test
    void savePrivateCellNote_returnedForAuthor() throws Exception {
        mockMvc.perform(put("/api/maps/" + mapId + "/notes/cell/3/3/private")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("content", "My secret"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/maps/" + mapId + "/notes/cell/3/3")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myPrivateContent").value("My secret"));
    }

    @Test
    void saveSharedMapNote_retrievableByAnyMember() throws Exception {
        mockMvc.perform(put("/api/maps/" + mapId + "/notes/map/shared")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("content", "Shared map lore"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/maps/" + mapId + "/notes/map")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sharedContent").value("Shared map lore"));
    }

    @Test
    void savePrivateMapNote_notReturnedForOtherUser() throws Exception {
        mockMvc.perform(put("/api/maps/" + mapId + "/notes/map/private")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("content", "DM private lore"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/maps/" + mapId + "/notes/map")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myPrivateContent").isEmpty());
    }
}
