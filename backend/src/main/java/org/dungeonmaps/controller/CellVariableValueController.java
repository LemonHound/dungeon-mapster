package org.dungeonmaps.controller;

import org.dungeonmaps.model.CellVariableValue;
import org.dungeonmaps.model.GridCellData;
import org.dungeonmaps.model.MapVariable;
import org.dungeonmaps.model.MapMembership.MapRole;
import org.dungeonmaps.service.CellVariableValueService;
import org.dungeonmaps.service.DungeonMapService;
import org.dungeonmaps.service.GridCellDataService;
import org.dungeonmaps.service.MapVariableService;
import org.dungeonmaps.websocket.MapCacheService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/maps/{mapId}/cells/{row}/{col}/variable-values")
public class CellVariableValueController {

    private final CellVariableValueService cellVariableValueService;
    private final MapVariableService mapVariableService;
    private final GridCellDataService gridCellDataService;
    private final DungeonMapService mapService;
    private final MapCacheService mapCacheService;

    public CellVariableValueController(CellVariableValueService cellVariableValueService,
                                       MapVariableService mapVariableService,
                                       GridCellDataService gridCellDataService,
                                       DungeonMapService mapService,
                                       MapCacheService mapCacheService) {
        this.cellVariableValueService = cellVariableValueService;
        this.mapVariableService = mapVariableService;
        this.gridCellDataService = gridCellDataService;
        this.mapService = mapService;
        this.mapCacheService = mapCacheService;
    }

    @GetMapping
    public ResponseEntity<List<CellVariableValue>> getValues(@PathVariable Long mapId,
                                                             @PathVariable Integer row,
                                                             @PathVariable Integer col,
                                                             Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!mapService.hasRole(mapId, userId, MapRole.OWNER, MapRole.DM, MapRole.PLAYER)) {
            return ResponseEntity.status(403).build();
        }
        GridCellData cell = gridCellDataService.getCell(mapId, row, col);
        if (cell == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(cellVariableValueService.getValuesForCell(cell.getId()));
    }

    @PutMapping("/{variableId}")
    public ResponseEntity<CellVariableValue> upsertValue(@PathVariable Long mapId,
                                                         @PathVariable Integer row,
                                                         @PathVariable Integer col,
                                                         @PathVariable String variableId,
                                                         @RequestBody Map<String, String> body,
                                                         Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        MapRole role = mapService.getMembership(mapId, userId)
                .map(m -> m.getRole())
                .orElse(null);
        if (role == null) return ResponseEntity.status(403).build();

        MapVariable variable = mapVariableService.getById(variableId).orElse(null);
        if (variable == null) return ResponseEntity.notFound().build();

        String visibility = variable.getVisibility();
        if ("DM_ONLY".equals(visibility) && role == MapRole.PLAYER) {
            return ResponseEntity.status(403).build();
        }
        if ("PLAYER_READ".equals(visibility) && role == MapRole.PLAYER) {
            return ResponseEntity.status(403).build();
        }

        GridCellData cell = gridCellDataService.getCell(mapId, row, col);
        if (cell == null) return ResponseEntity.badRequest().build();

        String value = body.get("value");
        if (value == null) return ResponseEntity.badRequest().build();

        CellVariableValue saved = cellVariableValueService.upsert(cell.getId(), variableId, value);
        mapCacheService.broadcastCellVariableUpdate(mapId, row, col, variableId, value, variable, userId);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{variableId}")
    public ResponseEntity<Void> deleteValue(@PathVariable Long mapId,
                                            @PathVariable Integer row,
                                            @PathVariable Integer col,
                                            @PathVariable String variableId,
                                            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        MapRole role = mapService.getMembership(mapId, userId)
                .map(m -> m.getRole())
                .orElse(null);
        if (role == null) return ResponseEntity.status(403).build();

        MapVariable variable = mapVariableService.getById(variableId).orElse(null);
        if (variable == null) return ResponseEntity.notFound().build();

        String visibility = variable.getVisibility();
        if ("DM_ONLY".equals(visibility) && role == MapRole.PLAYER) {
            return ResponseEntity.status(403).build();
        }
        if ("PLAYER_READ".equals(visibility) && role == MapRole.PLAYER) {
            return ResponseEntity.status(403).build();
        }

        GridCellData cell = gridCellDataService.getCell(mapId, row, col);
        if (cell == null) return ResponseEntity.notFound().build();

        boolean deleted = cellVariableValueService.delete(cell.getId(), variableId);
        if (!deleted) return ResponseEntity.notFound().build();

        mapCacheService.broadcastCellVariableUpdate(mapId, row, col, variableId, null, variable, userId);
        return ResponseEntity.ok().build();
    }
}
