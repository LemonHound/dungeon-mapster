package org.dungeonmaps.DungeonMapster.repository;

import org.dungeonmaps.DungeonMapster.model.GridCellData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GridCellDataRepository extends JpaRepository<GridCellData, Long> {
    Optional<GridCellData> findByMapIdAndRowIndexAndColIndex(Long mapId, Integer rowIndex, Integer colIndex);
}