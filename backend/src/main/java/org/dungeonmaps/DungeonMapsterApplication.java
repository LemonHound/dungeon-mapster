package org.dungeonmaps;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class DungeonMapsterApplication {
    public static void main(String[] args) {
        SpringApplication.run(DungeonMapsterApplication.class, args);
    }
}