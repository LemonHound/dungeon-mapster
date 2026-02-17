package org.dungeonmaps.DungeonMapster.repository;

import org.dungeonmaps.DungeonMapster.model.MapMembership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MapMembershipRepository extends JpaRepository<MapMembership, Long> {
    List<MapMembership> findByMapId(Long mapId);

    List<MapMembership> findByUserId(Long userId);

    Optional<MapMembership> findByMapIdAndUserId(Long mapId, Long userId);

    boolean existsByMapIdAndUserId(Long mapId, Long userId);

    long countByMapId(Long mapId);
}