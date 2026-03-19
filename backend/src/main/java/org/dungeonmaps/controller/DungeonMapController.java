package org.dungeonmaps.controller;

import org.dungeonmaps.model.DungeonMap;
import org.dungeonmaps.model.MapMembership;
import org.dungeonmaps.model.MapMembership.MapRole;
import org.dungeonmaps.service.DungeonMapService;
import org.dungeonmaps.websocket.MapCacheService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/maps")
public class DungeonMapController {

    private final DungeonMapService service;
    private final MapCacheService mapCacheService;

    public DungeonMapController(DungeonMapService service, MapCacheService mapCacheService) {
        this.service = service;
        this.mapCacheService = mapCacheService;
    }

    @GetMapping
    public List<DungeonMap> getUserMaps(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return service.getMapsByUserId(userId);
    }

    @GetMapping("/{id}")
    public ResponseEntity<DungeonMap> getMapById(@PathVariable Long id, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!service.hasRole(id, userId, MapRole.OWNER, MapRole.DM, MapRole.PLAYER)) {
            return ResponseEntity.status(403).build();
        }
        return service.getMapById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/join/{joinCode}")
    public ResponseEntity<DungeonMap> getMapByJoinCode(@PathVariable String joinCode) {
        return service.getMapByJoinCode(joinCode)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public DungeonMap createMap(@RequestBody DungeonMap map, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        map.setId(null);
        return service.createMap(map, userId);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DungeonMap> updateMap(@PathVariable Long id, @RequestBody DungeonMap map, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!service.hasRole(id, userId, MapRole.OWNER, MapRole.DM)) {
            return ResponseEntity.status(403).build();
        }
        return service.getMapById(id)
                .map(existing -> {
                    map.setId(id);
                    map.setUserId(existing.getUserId());
                    map.setJoinCode(existing.getJoinCode());
                    return ResponseEntity.ok(service.saveMap(map));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}")
    public ResponseEntity<DungeonMap> patchMap(@PathVariable Long id,
                                               @RequestBody Map<String, Object> body,
                                               Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!service.hasRole(id, userId, MapRole.OWNER, MapRole.DM)) {
            return ResponseEntity.status(403).build();
        }

        String field = (String) body.get("field");
        Object value = body.get("value");

        if (field == null || value == null) return ResponseEntity.badRequest().build();

        try {
            return service.patchField(id, field, value)
                    .map(saved -> {
                        mapCacheService.updateMapField(id, field, value);
                        mapCacheService.broadcastMapUpdate(id, field, value, userId);
                        return ResponseEntity.ok(saved);
                    })
                    .orElse(ResponseEntity.notFound().build());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMap(@PathVariable Long id, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        boolean deleted = service.deleteMap(id, userId);
        if (!deleted) return ResponseEntity.status(403).build();
        return ResponseEntity.ok().build();
    }

    @PostMapping("/join")
    public ResponseEntity<DungeonMap> joinMap(@RequestBody Map<String, String> body, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        String joinCode = body.get("joinCode");
        if (joinCode == null || joinCode.isBlank()) return ResponseEntity.badRequest().build();

        DungeonMapService.JoinResult result = service.joinMap(joinCode, userId);
        return switch (result) {
            case NOT_FOUND -> ResponseEntity.notFound().build();
            case ALREADY_MEMBER -> ResponseEntity.status(409).build();
            case JOINED -> service.getMapByJoinCode(joinCode)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.status(500).build());
        };
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<MapMembership>> getMembers(@PathVariable Long id, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!service.hasRole(id, userId, MapRole.OWNER, MapRole.DM, MapRole.PLAYER)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(service.getMembers(id));
    }

    @PostMapping("/{id}/members/{targetUserId}/promote")
    public ResponseEntity<Void> promote(@PathVariable Long id, @PathVariable Long targetUserId, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        boolean success = service.promoteToDm(id, userId, targetUserId);
        if (!success) return ResponseEntity.status(403).build();
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/members/{targetUserId}/demote")
    public ResponseEntity<Void> demote(@PathVariable Long id, @PathVariable Long targetUserId, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        boolean success = service.demoteToPlayer(id, userId, targetUserId);
        if (!success) return ResponseEntity.status(403).build();
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/transfer")
    public ResponseEntity<Void> transferOwnership(@PathVariable Long id, @RequestBody Map<String, Long> body, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        Long targetUserId = body.get("targetUserId");
        if (targetUserId == null) return ResponseEntity.badRequest().build();
        boolean success = service.transferOwnership(id, userId, targetUserId);
        if (!success) return ResponseEntity.status(403).build();
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}/members/{targetUserId}")
    public ResponseEntity<Void> removeMember(@PathVariable Long id, @PathVariable Long targetUserId, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        boolean success = service.removeMember(id, userId, targetUserId);
        if (!success) return ResponseEntity.status(403).build();
        return ResponseEntity.ok().build();
    }
}
