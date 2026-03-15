package org.dungeonmaps.DungeonMapster.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "cell_notes", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"map_id", "row_index", "col_index", "user_id", "type"})
})
public class CellNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "map_id", nullable = false)
    private Long mapId;

    @Column(name = "row_index", nullable = false)
    private Integer rowIndex;

    @Column(name = "col_index", nullable = false)
    private Integer colIndex;

    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false)
    private String type;

    @Column(columnDefinition = "TEXT")
    private String content;
}
