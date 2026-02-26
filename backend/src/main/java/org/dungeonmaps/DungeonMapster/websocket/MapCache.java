package org.dungeonmaps.DungeonMapster.websocket;

import org.dungeonmaps.DungeonMapster.model.DungeonMap;
import org.dungeonmaps.DungeonMapster.model.GridCellData;

import java.util.concurrent.ConcurrentHashMap;

public class MapCache {

    private volatile DungeonMap mapData;
    private final ConcurrentHashMap<String, GridCellData> cells = new ConcurrentHashMap<>();

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
}