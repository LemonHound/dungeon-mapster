package org.dungeonmaps.DungeonMapster.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
@Entity
@Table(name = "map_memberships",
        uniqueConstraints = @UniqueConstraint(columnNames = {"map_id", "user_id"}))
public class MapMembership {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "map_id", nullable = false)
    private Long mapId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MapRole role;

    public enum MapRole {
        OWNER, DM, PLAYER
    }
}