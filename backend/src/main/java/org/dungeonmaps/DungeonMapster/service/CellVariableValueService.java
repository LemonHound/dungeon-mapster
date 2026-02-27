package org.dungeonmaps.DungeonMapster.service;

import org.dungeonmaps.DungeonMapster.model.CellVariableValue;
import org.dungeonmaps.DungeonMapster.model.CellVariableValueId;
import org.dungeonmaps.DungeonMapster.repository.CellVariableValueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class CellVariableValueService {

    private final CellVariableValueRepository repository;

    public CellVariableValueService(CellVariableValueRepository repository) {
        this.repository = repository;
    }

    public List<CellVariableValue> getValuesForCell(Long cellId) {
        return repository.findByCellId(cellId);
    }

    @Transactional
    public CellVariableValue upsert(Long cellId, String variableId, String value) {
        CellVariableValueId pk = new CellVariableValueId(cellId, variableId);
        CellVariableValue cvv = repository.findById(pk).orElse(new CellVariableValue());
        cvv.setCellId(cellId);
        cvv.setVariableId(variableId);
        cvv.setValue(value);
        return repository.save(cvv);
    }

    @Transactional
    public boolean delete(Long cellId, String variableId) {
        CellVariableValueId pk = new CellVariableValueId(cellId, variableId);
        if (!repository.existsById(pk)) return false;
        repository.deleteById(pk);
        return true;
    }

    public Optional<CellVariableValue> getOne(Long cellId, String variableId) {
        return repository.findById(new CellVariableValueId(cellId, variableId));
    }
}