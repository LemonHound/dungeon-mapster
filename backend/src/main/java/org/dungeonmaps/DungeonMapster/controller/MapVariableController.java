package org.dungeonmaps.DungeonMapster.controller;

import org.dungeonmaps.DungeonMapster.model.MapVariable;
import org.dungeonmaps.DungeonMapster.model.PicklistValue;
import org.dungeonmaps.DungeonMapster.model.MapMembership.MapRole;
import org.dungeonmaps.DungeonMapster.service.DungeonMapService;
import org.dungeonmaps.DungeonMapster.service.MapVariableService;
import org.dungeonmaps.DungeonMapster.websocket.MapCacheService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/maps/{mapId}/variables")
public class MapVariableController {

    private final MapVariableService variableService;
    private final DungeonMapService mapService;
    private final MapCacheService mapCacheService;

    public MapVariableController(MapVariableService variableService,
                                 DungeonMapService mapService,
                                 MapCacheService mapCacheService) {
        this.variableService = variableService;
        this.mapService = mapService;
        this.mapCacheService = mapCacheService;
    }

    @GetMapping
    public ResponseEntity<List<MapVariable>> getVariables(@PathVariable Long mapId, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!mapService.hasRole(mapId, userId, MapRole.OWNER, MapRole.DM, MapRole.PLAYER)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(variableService.getVariablesForMap(mapId));
    }

    @PostMapping
    public ResponseEntity<MapVariable> createVariable(@PathVariable Long mapId,
                                                      @RequestBody MapVariable variable,
                                                      Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!mapService.hasRole(mapId, userId, MapRole.OWNER, MapRole.DM)) {
            return ResponseEntity.status(403).build();
        }
        MapVariable created = variableService.createVariable(mapId, variable);
        mapCacheService.broadcastVariableCreated(mapId, created, userId);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{variableId}")
    public ResponseEntity<MapVariable> updateVariable(@PathVariable Long mapId,
                                                      @PathVariable String variableId,
                                                      @RequestBody MapVariable patch,
                                                      Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!mapService.hasRole(mapId, userId, MapRole.OWNER, MapRole.DM)) {
            return ResponseEntity.status(403).build();
        }
        return variableService.updateVariable(variableId, patch)
                .map(updated -> {
                    mapCacheService.broadcastVariableUpdated(mapId, updated, userId);
                    return ResponseEntity.ok(updated);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{variableId}")
    public ResponseEntity<Void> deleteVariable(@PathVariable Long mapId,
                                               @PathVariable String variableId,
                                               Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!mapService.hasRole(mapId, userId, MapRole.OWNER, MapRole.DM)) {
            return ResponseEntity.status(403).build();
        }
        boolean deleted = variableService.deleteVariable(variableId);
        if (!deleted) return ResponseEntity.notFound().build();
        mapCacheService.broadcastVariableDeleted(mapId, variableId, userId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{variableId}/picklist-values")
    public ResponseEntity<List<PicklistValue>> getPicklistValues(@PathVariable Long mapId,
                                                                 @PathVariable String variableId,
                                                                 Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!mapService.hasRole(mapId, userId, MapRole.OWNER, MapRole.DM, MapRole.PLAYER)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(variableService.getPicklistValues(variableId));
    }

    @PostMapping("/{variableId}/picklist-values")
    public ResponseEntity<PicklistValue> addPicklistValue(@PathVariable Long mapId,
                                                          @PathVariable String variableId,
                                                          @RequestBody Map<String, String> body,
                                                          Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!mapService.hasRole(mapId, userId, MapRole.OWNER, MapRole.DM)) {
            return ResponseEntity.status(403).build();
        }
        String label = body.get("label");
        if (label == null || label.isBlank()) return ResponseEntity.badRequest().build();
        PicklistValue created = variableService.addPicklistValue(variableId, label);
        mapCacheService.broadcastPicklistValueAdded(mapId, variableId, created, userId);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{variableId}/picklist-values/{picklistValueId}")
    public ResponseEntity<PicklistValue> updatePicklistValue(@PathVariable Long mapId,
                                                             @PathVariable String variableId,
                                                             @PathVariable String picklistValueId,
                                                             @RequestBody Map<String, String> body,
                                                             Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!mapService.hasRole(mapId, userId, MapRole.OWNER, MapRole.DM)) {
            return ResponseEntity.status(403).build();
        }
        String label = body.get("label");
        if (label == null || label.isBlank()) return ResponseEntity.badRequest().build();
        return variableService.updatePicklistValue(picklistValueId, label)
                .map(updated -> {
                    mapCacheService.broadcastPicklistValueUpdated(mapId, variableId, updated, userId);
                    return ResponseEntity.ok(updated);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{variableId}/picklist-values/{picklistValueId}")
    public ResponseEntity<Void> deletePicklistValue(@PathVariable Long mapId,
                                                    @PathVariable String variableId,
                                                    @PathVariable String picklistValueId,
                                                    Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!mapService.hasRole(mapId, userId, MapRole.OWNER, MapRole.DM)) {
            return ResponseEntity.status(403).build();
        }
        boolean deleted = variableService.deletePicklistValue(picklistValueId);
        if (!deleted) return ResponseEntity.notFound().build();
        mapCacheService.broadcastPicklistValueDeleted(mapId, variableId, picklistValueId, userId);
        return ResponseEntity.ok().build();
    }
}