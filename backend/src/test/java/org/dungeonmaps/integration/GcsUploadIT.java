package org.dungeonmaps.integration;

import org.dungeonmaps.model.User;
import org.dungeonmaps.repository.UserRepository;
import org.dungeonmaps.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
@Import(TestContainersConfig.class)
class GcsUploadIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private String token;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        User user = new User();
        user.setEmail("gcs-test@example.com");
        user.setName("GCS Test User");
        user.setGoogleId("google-gcs-test");
        Long userId = userRepository.save(user).getId();
        token = jwtTokenProvider.generateToken(userId, "gcs-test@example.com");
    }

    @Test
    void uploadImage_storesInGcsAndReturnsFilename() throws Exception {
        byte[] imageBytes = new byte[1024];
        MockMultipartFile file = new MockMultipartFile(
                "file", "test-map.png", "image/png", imageBytes);

        mockMvc.perform(multipart("/api/upload/image")
                        .file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imageUrl").isNotEmpty());
    }

    @Test
    void downloadImage_byFilename_returnsFile() throws Exception {
        byte[] imageBytes = new byte[512];
        MockMultipartFile file = new MockMultipartFile(
                "file", "download-test.png", "image/png", imageBytes);

        String uploadResponse = mockMvc.perform(multipart("/api/upload/image")
                        .file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        String filename = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(uploadResponse).get("imageUrl").asText();

        mockMvc.perform(get("/api/upload/image/" + filename))
                .andExpect(status().isOk());
    }
}
