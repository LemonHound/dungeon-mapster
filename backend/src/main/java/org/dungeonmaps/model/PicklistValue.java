package org.dungeonmaps.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "picklist_values")
public class PicklistValue {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "variable_id", nullable = false)
    private String variableId;

    @Column(nullable = false)
    private String label;

    @Column(nullable = false)
    private String color;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
