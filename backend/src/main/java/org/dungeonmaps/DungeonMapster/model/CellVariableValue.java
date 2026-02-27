package org.dungeonmaps.DungeonMapster.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "cell_variable_values")
@IdClass(CellVariableValueId.class)
public class CellVariableValue {

    @Id
    @Column(name = "cell_id", nullable = false)
    private Long cellId;

    @Id
    @Column(name = "variable_id", nullable = false)
    private String variableId;

    @Column(nullable = false)
    private String value;
}