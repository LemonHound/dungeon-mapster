package org.dungeonmaps.websocket;

import org.dungeonmaps.model.DungeonMap;
import org.dungeonmaps.model.GridCellData;
import org.dungeonmaps.model.MapVariable;
import org.dungeonmaps.model.PicklistValue;
import org.dungeonmaps.model.CellVariableValue;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

public class MapCache {

    private volatile DungeonMap mapData;
    private final ConcurrentHashMap<String, GridCellData> cells = new ConcurrentHashMap<>();
    private final CopyOnWriteArrayList<MapVariable> variables = new CopyOnWriteArrayList<>();
    private final ConcurrentHashMap<String, List<PicklistValue>> picklistValues = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, List<CellVariableValue>> cellVariableValues = new ConcurrentHashMap<>();

    public MapCache(DungeonMap mapData) {
        this.mapData = mapData;
    }

    public DungeonMap getMapData() {
        return mapData;
    }

    public void setMapData(DungeonMap mapData) {
        this.mapData = mapData;
    }

    public ConcurrentHashMap<String, GridCellData> getCells() {
        return cells;
    }

    public static String cellKey(Integer row, Integer col) {
        return row + ":" + col;
    }

    public void putCell(GridCellData cell) {
        cells.put(cellKey(cell.getRowIndex(), cell.getColIndex()), cell);
    }

    public GridCellData getCell(Integer row, Integer col) {
        return cells.get(cellKey(row, col));
    }

    public CopyOnWriteArrayList<MapVariable> getVariables() {
        return variables;
    }

    public void setVariables(List<MapVariable> vars) {
        variables.clear();
        variables.addAll(vars);
    }

    public void putVariable(MapVariable variable) {
        variables.removeIf(v -> v.getId().equals(variable.getId()));
        variables.add(variable);
        variables.sort((a, b) -> Integer.compare(a.getSortOrder(), b.getSortOrder()));
    }

    public void removeVariable(String variableId) {
        variables.removeIf(v -> v.getId().equals(variableId));
        picklistValues.remove(variableId);
    }

    public ConcurrentHashMap<String, List<PicklistValue>> getPicklistValues() {
        return picklistValues;
    }

    public void setPicklistValues(String variableId, List<PicklistValue> values) {
        picklistValues.put(variableId, new CopyOnWriteArrayList<>(values));
    }

    public List<PicklistValue> getPicklistValuesForVariable(String variableId) {
        return picklistValues.getOrDefault(variableId, List.of());
    }

    public void putPicklistValue(String variableId, PicklistValue pv) {
        picklistValues.computeIfAbsent(variableId, k -> new CopyOnWriteArrayList<>());
        List<PicklistValue> list = picklistValues.get(variableId);
        ((CopyOnWriteArrayList<PicklistValue>) list).removeIf(p -> p.getId().equals(pv.getId()));
        ((CopyOnWriteArrayList<PicklistValue>) list).add(pv);
        ((CopyOnWriteArrayList<PicklistValue>) list).sort((a, b) -> Integer.compare(a.getSortOrder(), b.getSortOrder()));
    }

    public void removePicklistValue(String variableId, String picklistValueId) {
        List<PicklistValue> list = picklistValues.get(variableId);
        if (list instanceof CopyOnWriteArrayList<PicklistValue> cow) {
            cow.removeIf(p -> p.getId().equals(picklistValueId));
        }
    }

    public ConcurrentHashMap<String, List<CellVariableValue>> getCellVariableValues() {
        return cellVariableValues;
    }

    public void setCellVariableValues(Long cellId, List<CellVariableValue> values) {
        cellVariableValues.put(cellId.toString(), new CopyOnWriteArrayList<>(values));
    }

    public List<CellVariableValue> getCellVariableValuesForCell(Long cellId) {
        return cellVariableValues.getOrDefault(cellId.toString(), List.of());
    }

    public void putCellVariableValue(Long cellId, CellVariableValue cvv) {
        cellVariableValues.computeIfAbsent(cellId.toString(), k -> new CopyOnWriteArrayList<>());
        List<CellVariableValue> list = cellVariableValues.get(cellId.toString());
        ((CopyOnWriteArrayList<CellVariableValue>) list).removeIf(
                v -> v.getVariableId().equals(cvv.getVariableId()));
        ((CopyOnWriteArrayList<CellVariableValue>) list).add(cvv);
    }

    public void removeCellVariableValue(Long cellId, String variableId) {
        List<CellVariableValue> list = cellVariableValues.get(cellId.toString());
        if (list instanceof CopyOnWriteArrayList<CellVariableValue> cow) {
            cow.removeIf(v -> v.getVariableId().equals(variableId));
        }
    }

    public void removeCellVariableValuesByVariableId(String variableId) {
        for (List<CellVariableValue> list : cellVariableValues.values()) {
            if (list instanceof CopyOnWriteArrayList<CellVariableValue> cow) {
                cow.removeIf(v -> v.getVariableId().equals(variableId));
            }
        }
    }
}
