package org.dungeonmaps.config;

import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GcsConfig {

    @Bean
    @ConditionalOnMissingBean
    public Storage storage() {
        return StorageOptions.getDefaultInstance().getService();
    }
}