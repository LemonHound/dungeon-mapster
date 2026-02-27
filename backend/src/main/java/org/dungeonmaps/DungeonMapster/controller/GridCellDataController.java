package org.dungeonmaps.DungeonMapster.controller;

import org.dungeonmaps.DungeonMapster.model.GridCellData;
import org.dungeonmaps.DungeonMapster.service.GridCellDataService;
import org.dungeonmaps.DungeonMapster.websocket.MapCacheService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/grid-cells")
public class GridCellDataController {

    private final GridCellDataService service;
    private final MapCacheService mapCacheService;

    public GridCellDataController(GridCellDataService service, MapCacheService mapCacheService) {
        this.service = service;
        this.mapCacheService = mapCacheService;
    }

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
            @RequestBody GridCellData cellData,
            Authentication authentication
    ) {
        Long userId = (Long) authentication.getPrincipal();
        GridCellData saved = service.saveOrUpdate(mapId, row, col, cellData.getName());
        mapCacheService.updateCell(saved);
        mapCacheService.broadcastCellUpdate(saved, userId);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/{mapId}/{row}/{col}/ensure")
    public ResponseEntity<GridCellData> ensureCell(
            @PathVariable Long mapId,
            @PathVariable Integer row,
            @PathVariable Integer col,
            Authentication authentication
    ) {
        GridCellData cell = service.ensureExists(mapId, row, col);
        mapCacheService.updateCell(cell);
        return ResponseEntity.ok(cell);
    }
}