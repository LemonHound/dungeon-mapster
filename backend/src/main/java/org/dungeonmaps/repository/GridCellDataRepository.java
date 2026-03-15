package org.dungeonmaps.repository;

import org.dungeonmaps.model.GridCellData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GridCellDataRepository extends JpaRepository<GridCellData, Long> {
    Optional<GridCellData> findByMapIdAndRowIndexAndColIndex(Long mapId, Integer rowIndex, Integer colIndex);

    List<GridCellData> findByMapId(Long mapId);
}
