package org.dungeonmaps.DungeonMapster.repository;

import org.dungeonmaps.DungeonMapster.model.DungeonMap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DungeonMapRepository extends JpaRepository<DungeonMap, Long> {
    List<DungeonMap> findByUserId(Long userId);

    Optional<DungeonMap> findByJoinCode(String joinCode);
}