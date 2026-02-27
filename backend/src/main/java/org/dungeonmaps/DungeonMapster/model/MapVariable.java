package org.dungeonmaps.DungeonMapster.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "map_variables")
public class MapVariable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "map_id", nullable = false)
    private Long mapId;

    @Column(nullable = false)
    private String name;

    @Column(name = "data_type", nullable = false)
    private String dataType;

    @Column(name = "display_format")
    private String displayFormat;

    @Column(nullable = false)
    private String visibility;

    @Column(name = "show_color_on_cells", nullable = false)
    private boolean showColorOnCells = false;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}