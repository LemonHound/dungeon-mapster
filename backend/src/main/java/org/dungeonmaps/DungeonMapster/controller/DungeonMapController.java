package org.dungeonmaps.DungeonMapster.controller;

import org.dungeonmaps.DungeonMapster.model.DungeonMap;
import org.dungeonmaps.DungeonMapster.model.MapMembership;
import org.dungeonmaps.DungeonMapster.model.MapMembership.MapRole;
import org.dungeonmaps.DungeonMapster.service.DungeonMapService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/maps")
public class DungeonMapController {

    private final DungeonMapService service;

    public DungeonMapController(DungeonMapService service) {
        this.service = service;
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
            return ResponseEntity.notFound().build();
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

        boolean joined = service.joinMap(joinCode, userId);
        if (!joined) return ResponseEntity.badRequest().build();

        return service.getMapByJoinCode(joinCode)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(500).build());
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