package org.dungeonmaps.repository;

import org.dungeonmaps.model.MapNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MapNoteRepository extends JpaRepository<MapNote, Long> {

    Optional<MapNote> findByMapIdAndUserIdIsNullAndType(Long mapId, String type);

    Optional<MapNote> findByMapIdAndUserIdAndType(Long mapId, Long userId, String type);

    List<MapNote> findByMapIdAndTypeAndUserIdIsNotNull(Long mapId, String type);
}
