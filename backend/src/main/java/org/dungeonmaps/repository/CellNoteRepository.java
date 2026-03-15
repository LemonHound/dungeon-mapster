package org.dungeonmaps.repository;

import org.dungeonmaps.model.CellNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CellNoteRepository extends JpaRepository<CellNote, Long> {

    Optional<CellNote> findByMapIdAndRowIndexAndColIndexAndUserIdIsNullAndType(
            Long mapId, Integer rowIndex, Integer colIndex, String type);

    Optional<CellNote> findByMapIdAndRowIndexAndColIndexAndUserIdAndType(
            Long mapId, Integer rowIndex, Integer colIndex, Long userId, String type);

    List<CellNote> findByMapIdAndRowIndexAndColIndexAndTypeAndUserIdIsNotNull(
            Long mapId, Integer rowIndex, Integer colIndex, String type);
}
