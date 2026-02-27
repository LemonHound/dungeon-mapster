package org.dungeonmaps.DungeonMapster.websocket;

import org.dungeonmaps.DungeonMapster.model.*;
import org.dungeonmaps.DungeonMapster.model.MapMembership.MapRole;
import org.dungeonmaps.DungeonMapster.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MapCacheService {

    private static final Logger log = LoggerFactory.getLogger(MapCacheService.class);

    private final ConcurrentHashMap<Long, MapCache> caches = new ConcurrentHashMap<>();

    private final DungeonMapRepository mapRepository;
    private final GridCellDataRepository cellRepository;
    private final MapVariableRepository variableRepository;
    private final PicklistValueRepository picklistValueRepository;
    private final CellVariableValueRepository cellVariableValueRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final SessionRegistry sessionRegistry;

    public MapCacheService(DungeonMapRepository mapRepository,
                           GridCellDataRepository cellRepository,
                           MapVariableRepository variableRepository,
                           PicklistValueRepository picklistValueRepository,
                           CellVariableValueRepository cellVariableValueRepository,
                           SimpMessagingTemplate messagingTemplate,
                           SessionRegistry sessionRegistry) {
        this.mapRepository = mapRepository;
        this.cellRepository = cellRepository;
        this.variableRepository = variableRepository;
        this.picklistValueRepository = picklistValueRepository;
        this.cellVariableValueRepository = cellVariableValueRepository;
        this.messagingTemplate = messagingTemplate;
        this.sessionRegistry = sessionRegistry;
    }

    public MapCache getOrLoad(Long mapId) {
        return caches.computeIfAbsent(mapId, id -> {
            DungeonMap map = mapRepository.findById(id).orElseThrow();
            MapCache cache = new MapCache(map);

            List<GridCellData> cells = cellRepository.findByMapId(id);
            cells.forEach(cache::putCell);

            List<MapVariable> variables = variableRepository.findByMapIdOrderBySortOrder(id);
            cache.setVariables(variables);
            for (MapVariable v : variables) {
                if ("PICKLIST".equals(v.getDataType())) {
                    cache.setPicklistValues(v.getId(), picklistValueRepository.findByVariableIdOrderBySortOrder(v.getId()));
                }
            }

            for (GridCellData cell : cells) {
                List<CellVariableValue> values = cellVariableValueRepository.findByCellId(cell.getId());
                if (!values.isEmpty()) {
                    cache.setCellVariableValues(cell.getId(), values);
                }
            }

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

    public void broadcastVariableCreated(Long mapId, MapVariable variable, Long senderId) {
        MapCache cache = caches.get(mapId);
        if (cache != null) cache.putVariable(variable);

        Map<String, Object> message = new HashMap<>();
        message.put("type", "VARIABLE_CREATED");
        message.put("mapId", mapId);
        message.put("variable", variableToMapWithPicklistValues(mapId, variable));
        message.put("userId", senderId);

        broadcastFilteredByRole(mapId, message, variable.getVisibility());
    }

    public void broadcastVariableUpdated(Long mapId, MapVariable variable, Long senderId) {
        MapCache cache = caches.get(mapId);
        if (cache != null) cache.putVariable(variable);

        Map<String, Object> message = new HashMap<>();
        message.put("type", "VARIABLE_UPDATED");
        message.put("mapId", mapId);
        message.put("variable", variableToMapWithPicklistValues(mapId, variable));
        message.put("userId", senderId);

        broadcastFilteredByRole(mapId, message, variable.getVisibility());
    }

    public void broadcastVariableDeleted(Long mapId, String variableId, Long senderId) {
        MapCache cache = caches.get(mapId);
        if (cache != null) {
            cache.removeCellVariableValuesByVariableId(variableId);
            cache.removeVariable(variableId);
        }

        Map<String, Object> message = new HashMap<>();
        message.put("type", "VARIABLE_DELETED");
        message.put("mapId", mapId);
        message.put("variableId", variableId);
        message.put("userId", senderId);

        messagingTemplate.convertAndSend("/topic/map/" + mapId, message);
    }

    public void broadcastPicklistValueAdded(Long mapId, String variableId, PicklistValue pv, Long senderId) {
        MapCache cache = caches.get(mapId);
        if (cache != null) cache.putPicklistValue(variableId, pv);

        Map<String, Object> message = new HashMap<>();
        message.put("type", "PICKLIST_VALUE_ADDED");
        message.put("mapId", mapId);
        message.put("variableId", variableId);
        message.put("picklistValue", picklistValueToMap(pv));
        message.put("userId", senderId);

        messagingTemplate.convertAndSend("/topic/map/" + mapId, message);
    }

    public void broadcastPicklistValueUpdated(Long mapId, String variableId, PicklistValue pv, Long senderId) {
        MapCache cache = caches.get(mapId);
        if (cache != null) cache.putPicklistValue(variableId, pv);

        Map<String, Object> message = new HashMap<>();
        message.put("type", "PICKLIST_VALUE_UPDATED");
        message.put("mapId", mapId);
        message.put("variableId", variableId);
        message.put("picklistValue", picklistValueToMap(pv));
        message.put("userId", senderId);

        messagingTemplate.convertAndSend("/topic/map/" + mapId, message);
    }

    public void broadcastPicklistValueDeleted(Long mapId, String variableId, String picklistValueId, Long senderId) {
        MapCache cache = caches.get(mapId);
        if (cache != null) cache.removePicklistValue(variableId, picklistValueId);

        Map<String, Object> message = new HashMap<>();
        message.put("type", "PICKLIST_VALUE_DELETED");
        message.put("mapId", mapId);
        message.put("variableId", variableId);
        message.put("picklistValueId", picklistValueId);
        message.put("userId", senderId);

        messagingTemplate.convertAndSend("/topic/map/" + mapId, message);
    }

    public void broadcastCellVariableUpdate(Long mapId, Integer row, Integer col,
                                            String variableId, String value,
                                            MapVariable variable, Long senderId) {
        MapCache cache = caches.get(mapId);
        if (cache != null) {
            GridCellData cell = cache.getCell(row, col);
            if (cell != null) {
                if (value == null) {
                    cache.removeCellVariableValue(cell.getId(), variableId);
                } else {
                    CellVariableValue cvv = new CellVariableValue();
                    cvv.setCellId(cell.getId());
                    cvv.setVariableId(variableId);
                    cvv.setValue(value);
                    cache.putCellVariableValue(cell.getId(), cvv);
                }
            }
        }

        boolean isDmOnly = "DM_ONLY".equals(variable.getVisibility());
        Map<String, Object> fieldFlags = new HashMap<>();
        fieldFlags.put("isDmOnly", isDmOnly);
        fieldFlags.put("isReadOnly", "PLAYER_READ".equals(variable.getVisibility()));

        Map<String, Object> message = new HashMap<>();
        message.put("type", "CELL_VARIABLE_UPDATE");
        message.put("mapId", mapId);
        message.put("row", row);
        message.put("col", col);
        message.put("variableId", variableId);
        message.put("fieldFlags", fieldFlags);
        message.put("value", value != null ? value : "");
        message.put("cleared", value == null);
        message.put("userId", senderId);

        broadcastFilteredByRole(mapId, message, variable.getVisibility());
    }

    private void broadcastFilteredByRole(Long mapId, Map<String, Object> message, String visibility) {
        if (!"DM_ONLY".equals(visibility)) {
            messagingTemplate.convertAndSend("/topic/map/" + mapId, message);
            return;
        }
        for (UserSession s : sessionRegistry.getSessionsForMap(mapId)) {
            if (s.getRole() == MapRole.OWNER || s.getRole() == MapRole.DM) {
                messagingTemplate.convertAndSendToUser(
                        s.getSessionId(), "/queue/map/" + mapId, message);
            }
        }
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

    public void sendFullState(UserSession session, String clientId) {
        MapCache cache = getOrLoad(session.getMapId());
        boolean isDmOrOwner = session.getRole() == MapRole.OWNER || session.getRole() == MapRole.DM;

        List<Map<String, Object>> cellData = new ArrayList<>();
        for (GridCellData c : cache.getCells().values()) {
            Map<String, Object> cell = new HashMap<>();
            cell.put("row", c.getRowIndex());
            cell.put("col", c.getColIndex());
            cell.put("name", c.getName() != null ? c.getName() : "");

            List<Map<String, Object>> cvvList = new ArrayList<>();
            for (CellVariableValue cvv : cache.getCellVariableValuesForCell(c.getId())) {
                MapVariable variable = cache.getVariables().stream()
                        .filter(v -> v.getId().equals(cvv.getVariableId()))
                        .findFirst().orElse(null);
                if (variable == null) continue;
                if ("DM_ONLY".equals(variable.getVisibility()) && !isDmOrOwner) continue;
                Map<String, Object> cvvMap = new HashMap<>();
                cvvMap.put("variableId", cvv.getVariableId());
                cvvMap.put("value", cvv.getValue());
                cvvList.add(cvvMap);
            }
            cell.put("variableValues", cvvList);
            cellData.add(cell);
        }

        List<Map<String, Object>> variableList = new ArrayList<>();
        for (MapVariable v : cache.getVariables()) {
            if ("DM_ONLY".equals(v.getVisibility()) && !isDmOrOwner) continue;
            Map<String, Object> vm = variableToMap(v);
            if ("PICKLIST".equals(v.getDataType())) {
                List<Map<String, Object>> pvList = cache.getPicklistValuesForVariable(v.getId()).stream()
                        .map(this::picklistValueToMap)
                        .toList();
                vm.put("picklistValues", pvList);
            }
            variableList.add(vm);
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
        message.put("variables", variableList);
        message.put("users", users);

        messagingTemplate.convertAndSend("/topic/sync/" + clientId, message);
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
        return Objects.equals(a.getName(), b.getName())
                && Objects.equals(a.getGridType(), b.getGridType())
                && Objects.equals(a.getGridSize(), b.getGridSize())
                && Objects.equals(a.getGridOffsetX(), b.getGridOffsetX())
                && Objects.equals(a.getGridOffsetY(), b.getGridOffsetY())
                && Objects.equals(a.getGridScale(), b.getGridScale())
                && Objects.equals(a.getGridRotation(), b.getGridRotation())
                && Objects.equals(a.getHexOrientation(), b.getHexOrientation())
                && Objects.equals(a.getMapOffsetX(), b.getMapOffsetX())
                && Objects.equals(a.getMapOffsetY(), b.getMapOffsetY())
                && Objects.equals(a.getMapScale(), b.getMapScale());
    }

    private boolean cellsEqual(GridCellData a, GridCellData b) {
        return Objects.equals(a.getName(), b.getName());
    }

    private Map<String, Object> variableToMap(MapVariable v) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", v.getId());
        map.put("mapId", v.getMapId());
        map.put("name", v.getName());
        map.put("dataType", v.getDataType());
        map.put("displayFormat", v.getDisplayFormat());
        map.put("visibility", v.getVisibility());
        map.put("showColorOnCells", v.isShowColorOnCells());
        map.put("sortOrder", v.getSortOrder());
        return map;
    }

    private Map<String, Object> variableToMapWithPicklistValues(Long mapId, MapVariable v) {
        Map<String, Object> map = variableToMap(v);
        if ("PICKLIST".equals(v.getDataType())) {
            MapCache cache = caches.get(mapId);
            List<PicklistValue> pvs = cache != null
                    ? cache.getPicklistValuesForVariable(v.getId())
                    : List.of();
            List<Map<String, Object>> pvList = new ArrayList<>();
            for (PicklistValue pv : pvs) {
                pvList.add(picklistValueToMap(pv));
            }
            map.put("picklistValues", pvList);
        }
        return map;
    }

    private Map<String, Object> picklistValueToMap(PicklistValue pv) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", pv.getId());
        map.put("variableId", pv.getVariableId());
        map.put("label", pv.getLabel());
        map.put("color", pv.getColor());
        map.put("sortOrder", pv.getSortOrder());
        return map;
    }
}