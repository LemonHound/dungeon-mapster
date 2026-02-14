package org.dungeonmaps.DungeonMapster.controller;

import org.dungeonmaps.DungeonMapster.model.GridCellData;
import org.dungeonmaps.DungeonMapster.service.GridCellDataService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/grid-cells")
public class GridCellDataController {
    @Autowired
    private GridCellDataService service;

    @GetMapping("/{mapId}/{row}/{col}")
    public ResponseEntity<GridCellData> getCell(
            @PathVariable Long mapId,
            @PathVariable Integer row,
            @PathVariable Integer col
    ) {
        GridCellData cell = service.getCell(mapId, row, col);
        return cell != null ? ResponseEntity.ok(cell) : ResponseEntity.notFound().build();
    }

    @PostMapping("/{mapId}/{row}/{col}")
    public ResponseEntity<GridCellData> saveCell(
            @PathVariable Long mapId,
            @PathVariable Integer row,
            @PathVariable Integer col,
            @RequestBody GridCellData cellData
    ) {
        GridCellData saved = service.saveOrUpdate(mapId, row, col, cellData.getName());
        return ResponseEntity.ok(saved);
    }
}