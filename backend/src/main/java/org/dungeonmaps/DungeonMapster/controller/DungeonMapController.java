package org.dungeonmaps.DungeonMapster.controller;

import org.dungeonmaps.DungeonMapster.model.DungeonMap;
import org.dungeonmaps.DungeonMapster.service.DungeonMapService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
        return service.getMapById(id)
                .filter(map -> map.getUserId().equals(userId))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public DungeonMap createMap(@RequestBody DungeonMap map, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        map.setUserId(userId);
        map.setId(null);
        return service.saveMap(map);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DungeonMap> updateMap(@PathVariable Long id, @RequestBody DungeonMap map, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return service.getMapById(id)
                .filter(existing -> existing.getUserId().equals(userId))
                .map(existing -> {
                    map.setId(id);
                    map.setUserId(userId);
                    return ResponseEntity.ok(service.saveMap(map));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMap(@PathVariable Long id, Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return service.getMapById(id)
                .filter(map -> map.getUserId().equals(userId))
                .map(map -> {
                    service.deleteMap(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}