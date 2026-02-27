package org.dungeonmaps.DungeonMapster.repository;

import org.dungeonmaps.DungeonMapster.model.PicklistValue;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PicklistValueRepository extends JpaRepository<PicklistValue, String> {
    List<PicklistValue> findByVariableIdOrderBySortOrder(String variableId);

    void deleteByVariableId(String variableId);
}