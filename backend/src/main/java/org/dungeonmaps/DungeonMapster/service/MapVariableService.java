package org.dungeonmaps.DungeonMapster.service;

import org.dungeonmaps.DungeonMapster.model.MapVariable;
import org.dungeonmaps.DungeonMapster.model.PicklistValue;
import org.dungeonmaps.DungeonMapster.repository.CellVariableValueRepository;
import org.dungeonmaps.DungeonMapster.repository.MapVariableRepository;
import org.dungeonmaps.DungeonMapster.repository.PicklistValueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class MapVariableService {

    private static final String[] COLOR_PALETTE = {
            "#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#f39c12",
            "#1abc9c", "#e91e63", "#ff5722", "#607d8b", "#795548",
            "#00bcd4", "#8bc34a", "#ff9800", "#673ab7", "#009688"
    };

    private final MapVariableRepository variableRepository;
    private final PicklistValueRepository picklistValueRepository;
    private final CellVariableValueRepository cellVariableValueRepository;

    public MapVariableService(MapVariableRepository variableRepository,
                              PicklistValueRepository picklistValueRepository,
                              CellVariableValueRepository cellVariableValueRepository) {
        this.variableRepository = variableRepository;
        this.picklistValueRepository = picklistValueRepository;
        this.cellVariableValueRepository = cellVariableValueRepository;
    }

    public List<MapVariable> getVariablesForMap(Long mapId) {
        return variableRepository.findByMapIdOrderBySortOrder(mapId);
    }

    public Optional<MapVariable> getById(String id) {
        return variableRepository.findById(id);
    }

    @Transactional
    public MapVariable createVariable(Long mapId, MapVariable variable) {
        int count = variableRepository.countByMapId(mapId);
        variable.setMapId(mapId);
        variable.setSortOrder(count);
        if (!"PICKLIST".equals(variable.getDataType())) {
            variable.setShowColorOnCells(false);
        }
        return variableRepository.save(variable);
    }

    @Transactional
    public Optional<MapVariable> updateVariable(String id, MapVariable patch) {
        return variableRepository.findById(id).map(existing -> {
            existing.setName(patch.getName());
            existing.setVisibility(patch.getVisibility());
            existing.setDisplayFormat(patch.getDisplayFormat());
            if ("PICKLIST".equals(existing.getDataType())) {
                existing.setShowColorOnCells(patch.isShowColorOnCells());
            }
            return variableRepository.save(existing);
        });
    }

    @Transactional
    public boolean deleteVariable(String id) {
        if (!variableRepository.existsById(id)) return false;
        cellVariableValueRepository.deleteByVariableId(id);
        picklistValueRepository.deleteByVariableId(id);
        variableRepository.deleteById(id);
        return true;
    }

    public List<PicklistValue> getPicklistValues(String variableId) {
        return picklistValueRepository.findByVariableIdOrderBySortOrder(variableId);
    }

    @Transactional
    public PicklistValue addPicklistValue(String variableId, String label) {
        List<PicklistValue> existing = picklistValueRepository.findByVariableIdOrderBySortOrder(variableId);
        String color = assignColor(existing.size());

        PicklistValue pv = new PicklistValue();
        pv.setVariableId(variableId);
        pv.setLabel(label);
        pv.setColor(color);
        pv.setSortOrder(existing.size());
        return picklistValueRepository.save(pv);
    }

    @Transactional
    public Optional<PicklistValue> updatePicklistValue(String picklistValueId, String label) {
        return picklistValueRepository.findById(picklistValueId).map(pv -> {
            pv.setLabel(label);
            return picklistValueRepository.save(pv);
        });
    }

    @Transactional
    public boolean deletePicklistValue(String picklistValueId) {
        return picklistValueRepository.findById(picklistValueId).map(pv -> {
            cellVariableValueRepository.deleteByVariableIdAndValue(pv.getVariableId(), picklistValueId);
            picklistValueRepository.deleteById(picklistValueId);
            return true;
        }).orElse(false);
    }

    private String assignColor(int index) {
        if (index < COLOR_PALETTE.length) {
            return COLOR_PALETTE[index];
        }
        int r = (int) (Math.random() * 200 + 30);
        int g = (int) (Math.random() * 200 + 30);
        int b = (int) (Math.random() * 200 + 30);
        return String.format("#%02x%02x%02x", r, g, b);
    }
}