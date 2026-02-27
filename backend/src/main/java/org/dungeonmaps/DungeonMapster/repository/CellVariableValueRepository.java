package org.dungeonmaps.DungeonMapster.repository;

import org.dungeonmaps.DungeonMapster.model.CellVariableValue;
import org.dungeonmaps.DungeonMapster.model.CellVariableValueId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CellVariableValueRepository extends JpaRepository<CellVariableValue, CellVariableValueId> {
    List<CellVariableValue> findByCellId(Long cellId);

    List<CellVariableValue> findByVariableId(String variableId);

    @Modifying
    @Query("DELETE FROM CellVariableValue c WHERE c.variableId = :variableId")
    void deleteByVariableId(@Param("variableId") String variableId);

    @Modifying
    @Query("DELETE FROM CellVariableValue c WHERE c.variableId = :variableId AND c.value = :picklistValueId")
    void deleteByVariableIdAndValue(@Param("variableId") String variableId, @Param("picklistValueId") String picklistValueId);
}