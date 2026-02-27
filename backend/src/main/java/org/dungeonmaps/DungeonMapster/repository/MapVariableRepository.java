package org.dungeonmaps.DungeonMapster.repository;

import org.dungeonmaps.DungeonMapster.model.MapVariable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MapVariableRepository extends JpaRepository<MapVariable, String> {
    List<MapVariable> findByMapIdOrderBySortOrder(Long mapId);

    int countByMapId(Long mapId);

    void deleteByMapId(Long mapId);
}