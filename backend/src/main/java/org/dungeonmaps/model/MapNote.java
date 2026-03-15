package org.dungeonmaps.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "map_notes", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"map_id", "user_id", "type"})
})
public class MapNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "map_id", nullable = false)
    private Long mapId;

    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false)
    private String type;

    @Column(columnDefinition = "TEXT")
    private String content;
}
