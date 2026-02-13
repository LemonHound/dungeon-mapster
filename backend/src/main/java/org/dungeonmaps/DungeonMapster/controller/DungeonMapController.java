package org.dungeonmaps.DungeonMapster.controller;

import org.dungeonmaps.DungeonMapster.model.DungeonMap;
import org.dungeonmaps.DungeonMapster.service.DungeonMapService;
import org.springframework.http.ResponseEntity;
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
    public List<DungeonMap> getAllMaps() {
        return service.getAllMaps();
    }

    @GetMapping("/{id}")
    public ResponseEntity<DungeonMap> getMapById(@PathVariable Long id) {
        return service.getMapById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public DungeonMap createMap(@RequestBody DungeonMap map) {
        return service.saveMap(map);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DungeonMap> updateMap(@PathVariable Long id, @RequestBody DungeonMap map) {
        return service.getMapById(id)
                .map(existing -> {
                    map.setId(id);
                    return ResponseEntity.ok(service.saveMap(map));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMap(@PathVariable Long id) {
        if (service.getMapById(id).isPresent()) {
            service.deleteMap(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }
}