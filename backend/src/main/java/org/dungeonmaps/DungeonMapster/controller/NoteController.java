package org.dungeonmaps.DungeonMapster.controller;

import org.dungeonmaps.DungeonMapster.model.MapMembership.MapRole;
import org.dungeonmaps.DungeonMapster.service.DungeonMapService;
import org.dungeonmaps.DungeonMapster.service.NoteService;
import org.dungeonmaps.DungeonMapster.websocket.MapCacheService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/maps/{mapId}/notes")
public class NoteController {

    private final NoteService noteService;
    private final DungeonMapService mapService;
    private final MapCacheService mapCacheService;

    public NoteController(NoteService noteService, DungeonMapService mapService, MapCacheService mapCacheService) {
        this.noteService = noteService;
        this.mapService = mapService;
        this.mapCacheService = mapCacheService;
    }

    @GetMapping("/cell/{row}/{col}")
    public ResponseEntity<NoteService.NoteBundle> getCellNotes(@PathVariable Long mapId,
                                                               @PathVariable Integer row,
                                                               @PathVariable Integer col,
                                                               Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!mapService.hasRole(mapId, userId, MapRole.OWNER, MapRole.DM, MapRole.PLAYER)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(noteService.getCellNotes(mapId, row, col, userId));
    }

    @PutMapping("/cell/{row}/{col}/{type}")
    public ResponseEntity<Void> saveCellNote(@PathVariable Long mapId,
                                             @PathVariable Integer row,
                                             @PathVariable Integer col,
                                             @PathVariable String type,
                                             @RequestBody Map<String, String> body,
                                             Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!mapService.hasRole(mapId, userId, MapRole.OWNER, MapRole.DM, MapRole.PLAYER)) {
            return ResponseEntity.status(403).build();
        }
        if (!"shared".equals(type) && !"public".equals(type) && !"private".equals(type)) {
            return ResponseEntity.badRequest().build();
        }
        if ("public".equals(type) || "private".equals(type)) {
            // only the owning user can write their own note — enforced by userId binding in service
        }
        String content = body.getOrDefault("content", "");
        noteService.saveCellNote(mapId, row, col, userId, type, content);
        if (!"private".equals(type)) {
            mapCacheService.broadcastCellNoteUpdate(mapId, row, col, type, content, userId);
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/map")
    public ResponseEntity<NoteService.NoteBundle> getMapNotes(@PathVariable Long mapId,
                                                              Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!mapService.hasRole(mapId, userId, MapRole.OWNER, MapRole.DM, MapRole.PLAYER)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(noteService.getMapNotes(mapId, userId));
    }

    @PutMapping("/map/{type}")
    public ResponseEntity<Void> saveMapNote(@PathVariable Long mapId,
                                            @PathVariable String type,
                                            @RequestBody Map<String, String> body,
                                            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        if (!mapService.hasRole(mapId, userId, MapRole.OWNER, MapRole.DM, MapRole.PLAYER)) {
            return ResponseEntity.status(403).build();
        }
        if (!"shared".equals(type) && !"public".equals(type) && !"private".equals(type)) {
            return ResponseEntity.badRequest().build();
        }
        String content = body.getOrDefault("content", "");
        noteService.saveMapNote(mapId, userId, type, content);
        if (!"private".equals(type)) {
            mapCacheService.broadcastMapNoteUpdate(mapId, type, content, userId);
        }
        return ResponseEntity.ok().build();
    }
}
