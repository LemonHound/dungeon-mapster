package org.dungeonmaps.DungeonMapster.service;

import org.dungeonmaps.DungeonMapster.model.DungeonMap;
import org.dungeonmaps.DungeonMapster.model.MapMembership;
import org.dungeonmaps.DungeonMapster.model.MapMembership.MapRole;
import org.dungeonmaps.DungeonMapster.repository.DungeonMapRepository;
import org.dungeonmaps.DungeonMapster.repository.MapMembershipRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.Optional;

@Service
public class DungeonMapService {

    private static final String JOIN_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final int JOIN_CODE_LENGTH = 16;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final DungeonMapRepository mapRepository;
    private final MapMembershipRepository membershipRepository;

    public DungeonMapService(DungeonMapRepository mapRepository,
                             MapMembershipRepository membershipRepository) {
        this.mapRepository = mapRepository;
        this.membershipRepository = membershipRepository;
    }

    public List<DungeonMap> getMapsByUserId(Long userId) {
        return membershipRepository.findByUserId(userId).stream()
                .map(m -> mapRepository.findById(m.getMapId()))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .toList();
    }

    public Optional<DungeonMap> getMapById(Long mapId) {
        return mapRepository.findById(mapId);
    }

    public Optional<DungeonMap> getMapByJoinCode(String joinCode) {
        return mapRepository.findByJoinCode(joinCode);
    }

    public Optional<MapMembership> getMembership(Long mapId, Long userId) {
        return membershipRepository.findByMapIdAndUserId(mapId, userId);
    }

    public List<MapMembership> getMembers(Long mapId) {
        return membershipRepository.findByMapId(mapId);
    }

    public boolean hasRole(Long mapId, Long userId, MapRole... roles) {
        return getMembership(mapId, userId)
                .map(m -> {
                    for (MapRole role : roles) {
                        if (m.getRole() == role) return true;
                    }
                    return false;
                })
                .orElse(false);
    }

    @Transactional
    public DungeonMap createMap(DungeonMap map, Long userId) {
        map.setUserId(userId);
        map.setJoinCode(generateJoinCode());
        DungeonMap saved = mapRepository.save(map);

        MapMembership membership = new MapMembership();
        membership.setMapId(saved.getId());
        membership.setUserId(userId);
        membership.setRole(MapRole.OWNER);
        membershipRepository.save(membership);

        return saved;
    }

    public DungeonMap saveMap(DungeonMap map) {
        return mapRepository.save(map);
    }

    @Transactional
    public boolean joinMap(String joinCode, Long userId) {
        Optional<DungeonMap> map = mapRepository.findByJoinCode(joinCode);
        if (map.isEmpty()) return false;

        Long mapId = map.get().getId();
        if (membershipRepository.existsByMapIdAndUserId(mapId, userId)) return false;

        MapMembership membership = new MapMembership();
        membership.setMapId(mapId);
        membership.setUserId(userId);
        membership.setRole(MapRole.PLAYER);
        membershipRepository.save(membership);
        return true;
    }

    @Transactional
    public boolean promoteToDm(Long mapId, Long requesterId, Long targetUserId) {
        if (!hasRole(mapId, requesterId, MapRole.OWNER, MapRole.DM)) return false;

        return membershipRepository.findByMapIdAndUserId(mapId, targetUserId)
                .filter(m -> m.getRole() == MapRole.PLAYER)
                .map(m -> {
                    m.setRole(MapRole.DM);
                    membershipRepository.save(m);
                    return true;
                })
                .orElse(false);
    }

    @Transactional
    public boolean demoteToPlayer(Long mapId, Long requesterId, Long targetUserId) {
        if (!hasRole(mapId, requesterId, MapRole.OWNER, MapRole.DM)) return false;

        return membershipRepository.findByMapIdAndUserId(mapId, targetUserId)
                .filter(m -> m.getRole() == MapRole.DM)
                .map(m -> {
                    m.setRole(MapRole.PLAYER);
                    membershipRepository.save(m);
                    return true;
                })
                .orElse(false);
    }

    @Transactional
    public boolean transferOwnership(Long mapId, Long ownerId, Long targetUserId) {
        if (!hasRole(mapId, ownerId, MapRole.OWNER)) return false;

        Optional<MapMembership> targetMembership = membershipRepository.findByMapIdAndUserId(mapId, targetUserId);
        if (targetMembership.isEmpty() || targetMembership.get().getRole() != MapRole.DM) return false;

        membershipRepository.findByMapIdAndUserId(mapId, ownerId).ifPresent(m -> {
            m.setRole(MapRole.DM);
            membershipRepository.save(m);
        });

        targetMembership.get().setRole(MapRole.OWNER);
        membershipRepository.save(targetMembership.get());

        DungeonMap map = mapRepository.findById(mapId).orElseThrow();
        map.setUserId(targetUserId);
        mapRepository.save(map);

        return true;
    }

    @Transactional
    public boolean removeMember(Long mapId, Long requesterId, Long targetUserId) {
        Optional<MapMembership> targetMembership = membershipRepository.findByMapIdAndUserId(mapId, targetUserId);
        if (targetMembership.isEmpty()) return false;

        boolean isSelf = requesterId.equals(targetUserId);
        boolean requesterIsOwner = hasRole(mapId, requesterId, MapRole.OWNER);

        MapRole targetRole = targetMembership.get().getRole();
        if (targetRole == MapRole.OWNER) return false;

        if (!isSelf && !requesterIsOwner) return false;

        membershipRepository.delete(targetMembership.get());
        return true;
    }

    @Transactional
    public boolean deleteMap(Long mapId, Long requesterId) {
        if (!hasRole(mapId, requesterId, MapRole.OWNER)) return false;

        long memberCount = membershipRepository.countByMapId(mapId);
        if (memberCount > 1) return false;

        membershipRepository.findByMapIdAndUserId(mapId, requesterId)
                .ifPresent(membershipRepository::delete);
        mapRepository.deleteById(mapId);
        return true;
    }

    private String generateJoinCode() {
        StringBuilder sb = new StringBuilder(JOIN_CODE_LENGTH);
        for (int i = 0; i < JOIN_CODE_LENGTH; i++) {
            sb.append(JOIN_CODE_CHARS.charAt(RANDOM.nextInt(JOIN_CODE_CHARS.length())));
        }
        return sb.toString();
    }
}