package org.dungeonmaps.DungeonMapster.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Setter
@Getter
@Entity
@Table(name = "dungeon_maps")
public class DungeonMap {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "grid_type")
    private String gridType;

    @Column(name = "grid_size")
    private Integer gridSize;

    @Column(name = "grid_offset_x")
    private Double gridOffsetX;

    @Column(name = "grid_offset_y")
    private Double gridOffsetY;

    @Column(name = "grid_rotation")
    private Double gridRotation;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

}