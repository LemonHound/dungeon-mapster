package org.dungeonmaps.model;

import java.io.Serializable;
import java.util.Objects;

public class CellVariableValueId implements Serializable {

    private Long cellId;
    private String variableId;

    public CellVariableValueId() {
    }

    public CellVariableValueId(Long cellId, String variableId) {
        this.cellId = cellId;
        this.variableId = variableId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof CellVariableValueId that)) return false;
        return Objects.equals(cellId, that.cellId) && Objects.equals(variableId, that.variableId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(cellId, variableId);
    }
}
