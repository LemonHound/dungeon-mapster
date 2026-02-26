package org.dungeonmaps.DungeonMapster.websocket;

import org.dungeonmaps.DungeonMapster.model.DungeonMap;
import org.dungeonmaps.DungeonMapster.model.GridCellData;
import org.dungeonmaps.DungeonMapster.repository.DungeonMapRepository;
import org.dungeonmaps.DungeonMapster.repository.GridCellDataRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MapCacheService {

    private static final Logger log = LoggerFactory.getLogger(MapCacheService.class);

    private final ConcurrentHashMap<Long, MapCache> caches = new ConcurrentHashMap<>();

    private final DungeonMapRepository mapRepository;
    private final GridCellDataRepository cellRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final SessionRegistry sessionRegistry;

    public MapCacheService(DungeonMapRepository mapRepository,
                           GridCellDataRepository cellRepository,
                           SimpMessagingTemplate messagingTemplate,
                           SessionRegistry sessionRegistry) {
        this.mapRepository = mapRepository;
        this.cellRepository = cellRepository;
        this.messagingTemplate = messagingTemplate;
        this.sessionRegistry = sessionRegistry;
    }

    public MapCache getOrLoad(Long mapId) {
        return caches.computeIfAbsent(mapId, id -> {
            DungeonMap map = mapRepository.findById(id).orElseThrow();
            MapCache cache = new MapCache(map);
            List<GridCellData> cells = cellRepository.findByMapId(id);
            cells.forEach(cache::putCell);
            return cache;
        });
    }

    public void evictIfEmpty(Long mapId) {
        if (!sessionRegistry.hasActiveSessionsForMap(mapId)) {
            caches.remove(mapId);
        }
    }

    public void updateCell(GridCellData saved) {
        MapCache cache = caches.get(saved.getMapId());
        if (cache != null) {
            cache.putCell(saved);
        }
    }

    public void updateMapField(Long mapId, String field, Object value) {
        MapCache cache = caches.get(mapId);
        if (cache == null) return;

        DungeonMap map = cache.getMapData();
        switch (field) {
            case "name" -> map.setName((String) value);
            case "gridType" -> map.setGridType((String) value);
            case "gridSize" -> map.setGridSize(((Number) value).intValue());
            case "gridOffsetX" -> map.setGridOffsetX(((Number) value).doubleValue());
            case "gridOffsetY" -> map.setGridOffsetY(((Number) value).doubleValue());
            case "gridRotation" -> map.setGridRotation(((Number) value).doubleValue());
            case "gridScale" -> map.setGridScale(((Number) value).doubleValue());
            case "hexOrientation" -> map.setHexOrientation((String) value);
            case "mapOffsetX" -> map.setMapOffsetX(((Number) value).doubleValue());
            case "mapOffsetY" -> map.setMapOffsetY(((Number) value).doubleValue());
            case "mapScale" -> map.setMapScale(((Number) value).doubleValue());
            default -> log.warn("Unknown map field in cache update: {}", field);
        }
    }

    public void broadcastCellUpdate(GridCellData saved, Long senderId) {
        Long mapId = saved.getMapId();
        Map<String, Object> fieldFlags = new HashMap<>();
        fieldFlags.put("isDmOnly", false);
        fieldFlags.put("isReadOnly", false);

        Map<String, Object> message = new HashMap<>();
        message.put("type", "CELL_UPDATE");
        message.put("mapId", mapId);
        message.put("row", saved.getRowIndex());
        message.put("col", saved.getColIndex());
        message.put("field", "name");
        message.put("fieldFlags", fieldFlags);
        message.put("value", saved.getName() != null ? saved.getName() : "");
        message.put("userId", senderId);

        messagingTemplate.convertAndSend("/topic/map/" + mapId, message);
    }

    public void broadcastMapUpdate(Long mapId, String field, Object value, Long senderId) {
        Map<String, Object> fieldFlags = new HashMap<>();
        fieldFlags.put("isDmOnly", false);
        fieldFlags.put("isReadOnly", false);

        Map<String, Object> message = new HashMap<>();
        message.put("type", "MAP_UPDATE");
        message.put("mapId", mapId);
        message.put("field", field);
        message.put("fieldFlags", fieldFlags);
        message.put("value", value != null ? value : "");
        message.put("userId", senderId);

        messagingTemplate.convertAndSend("/topic/map/" + mapId, message);
    }

    public void broadcastPresenceJoined(UserSession session) {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "USER_JOINED");
        message.put("userId", session.getUserId());
        message.put("userName", session.getUserName());
        message.put("color", session.getColor());
        message.put("role", session.getRole().name());

        messagingTemplate.convertAndSend("/topic/map/" + session.getMapId(), message);
    }

    public void broadcastPresenceLeft(UserSession session) {
        Map<String, Object> message = new HashMap<>();
        message.put("type", "USER_LEFT");
        message.put("userId", session.getUserId());

        messagingTemplate.convertAndSend("/topic/map/" + session.getMapId(), message);
    }

    public void sendFullState(UserSession session) {
        MapCache cache = getOrLoad(session.getMapId());

        List<Map<String, Object>> cellData = new ArrayList<>();
        for (GridCellData c : cache.getCells().values()) {
            Map<String, Object> cell = new HashMap<>();
            cell.put("row", c.getRowIndex());
            cell.put("col", c.getColIndex());
            cell.put("name", c.getName() != null ? c.getName() : "");
            cellData.add(cell);
        }

        List<Map<String, Object>> users = new ArrayList<>();
        for (UserSession s : sessionRegistry.getSessionsForMap(session.getMapId())) {
            if (s.getSessionId().equals(session.getSessionId())) continue;
            Map<String, Object> user = new HashMap<>();
            user.put("userId", s.getUserId());
            user.put("userName", s.getUserName());
            user.put("color", s.getColor());
            user.put("role", s.getRole().name());
            users.add(user);
        }

        Map<String, Object> message = new HashMap<>();
        message.put("type", "FULL_STATE");
        message.put("mapData", cache.getMapData());
        message.put("cellData", cellData);
        message.put("users", users);

        messagingTemplate.convertAndSendToUser(session.getSessionId(), "/queue/sync", message);
    }

    @Scheduled(fixedDelay = 60000)
    public void reconcile() {
        for (Long mapId : caches.keySet()) {
            MapCache cache = caches.get(mapId);
            if (cache == null) continue;

            mapRepository.findById(mapId).ifPresent(dbMap -> {
                DungeonMap cached = cache.getMapData();
                if (!mapsEqual(cached, dbMap)) {
                    log.warn("Cache/DB mismatch for map {}, correcting", mapId);
                    cache.setMapData(dbMap);
                }
            });

            List<GridCellData> dbCells = cellRepository.findByMapId(mapId);
            for (GridCellData dbCell : dbCells) {
                GridCellData cachedCell = cache.getCell(dbCell.getRowIndex(), dbCell.getColIndex());
                if (cachedCell == null || !cellsEqual(cachedCell, dbCell)) {
                    log.warn("Cache/DB cell mismatch for map {} [{},{}], correcting",
                            mapId, dbCell.getRowIndex(), dbCell.getColIndex());
                    cache.putCell(dbCell);
                }
            }
        }
    }

    private boolean mapsEqual(DungeonMap a, DungeonMap b) {
        return java.util.Objects.equals(a.getName(), b.getName())
                && java.util.Objects.equals(a.getGridType(), b.getGridType())
                && java.util.Objects.equals(a.getGridSize(), b.getGridSize())
                && java.util.Objects.equals(a.getGridOffsetX(), b.getGridOffsetX())
                && java.util.Objects.equals(a.getGridOffsetY(), b.getGridOffsetY())
                && java.util.Objects.equals(a.getGridScale(), b.getGridScale())
                && java.util.Objects.equals(a.getGridRotation(), b.getGridRotation())
                && java.util.Objects.equals(a.getHexOrientation(), b.getHexOrientation())
                && java.util.Objects.equals(a.getMapOffsetX(), b.getMapOffsetX())
                && java.util.Objects.equals(a.getMapOffsetY(), b.getMapOffsetY())
                && java.util.Objects.equals(a.getMapScale(), b.getMapScale());
    }

    private boolean cellsEqual(GridCellData a, GridCellData b) {
        return java.util.Objects.equals(a.getName(), b.getName());
    }
}