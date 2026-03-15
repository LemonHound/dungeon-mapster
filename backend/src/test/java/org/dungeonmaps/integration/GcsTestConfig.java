package org.dungeonmaps.integration;

import com.google.cloud.storage.Storage;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import static org.mockito.Mockito.mock;

@TestConfiguration
public class GcsTestConfig {

    @Bean
    @Primary
    public Storage storage() {
        return mock(Storage.class);
    }
}
