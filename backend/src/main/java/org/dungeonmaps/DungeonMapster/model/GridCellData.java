package org.dungeonmaps.DungeonMapster.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "grid_cells")
@Data
public class GridCellData {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long mapId;

    @Column(nullable = false)
    private Integer rowIndex;

    @Column(nullable = false)
    private Integer colIndex;

    private String name;
}