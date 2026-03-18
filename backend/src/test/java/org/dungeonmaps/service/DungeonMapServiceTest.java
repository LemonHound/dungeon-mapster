package org.dungeonmaps.service;

import org.dungeonmaps.model.DungeonMap;
import org.dungeonmaps.model.MapMembership;
import org.dungeonmaps.model.MapMembership.MapRole;
import org.dungeonmaps.repository.DungeonMapRepository;
import org.dungeonmaps.repository.MapMembershipRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DungeonMapServiceTest {

    @Mock
    private DungeonMapRepository mapRepository;
    @Mock
    private MapMembershipRepository membershipRepository;

    private DungeonMapService service;

    @BeforeEach
    void setUp() {
        service = new DungeonMapService(mapRepository, membershipRepository);
    }

    private MapMembership membership(Long mapId, Long userId, MapRole role) {
        MapMembership m = new MapMembership();
        m.setMapId(mapId);
        m.setUserId(userId);
        m.setRole(role);
        return m;
    }

    @Test
    void hasRole_trueWhenRoleMatches() {
        when(membershipRepository.findByMapIdAndUserId(1L, 2L))
                .thenReturn(Optional.of(membership(1L, 2L, MapRole.DM)));
        assertThat(service.hasRole(1L, 2L, MapRole.DM, MapRole.OWNER)).isTrue();
    }

    @Test
    void hasRole_falseWhenNoMembership() {
        when(membershipRepository.findByMapIdAndUserId(1L, 2L)).thenReturn(Optional.empty());
        assertThat(service.hasRole(1L, 2L, MapRole.OWNER)).isFalse();
    }

    @Test
    void hasRole_falseWhenRoleDoesNotMatch() {
        when(membershipRepository.findByMapIdAndUserId(1L, 2L))
                .thenReturn(Optional.of(membership(1L, 2L, MapRole.PLAYER)));
        assertThat(service.hasRole(1L, 2L, MapRole.OWNER)).isFalse();
    }

    @Test
    void createMap_savesMapAndOwnerMembership() {
        DungeonMap input = new DungeonMap();
        input.setName("Test Map");

        DungeonMap saved = new DungeonMap();
        saved.setId(10L);
        saved.setName("Test Map");

        when(mapRepository.save(any(DungeonMap.class))).thenReturn(saved);

        DungeonMap result = service.createMap(input, 5L);

        assertThat(result.getId()).isEqualTo(10L);
        assertThat(input.getUserId()).isEqualTo(5L);
        assertThat(input.getJoinCode()).isNotBlank().hasSize(16);

        ArgumentCaptor<MapMembership> captor = ArgumentCaptor.forClass(MapMembership.class);
        verify(membershipRepository).save(captor.capture());
        assertThat(captor.getValue().getRole()).isEqualTo(MapRole.OWNER);
        assertThat(captor.getValue().getUserId()).isEqualTo(5L);
        assertThat(captor.getValue().getMapId()).isEqualTo(10L);
    }

    @Test
    void joinMap_falseWhenJoinCodeNotFound() {
        when(mapRepository.findByJoinCode("invalid")).thenReturn(Optional.empty());
        assertThat(service.joinMap("invalid", 1L)).isEqualTo(DungeonMapService.JoinResult.NOT_FOUND);
    }

    @Test
    void joinMap_falseWhenAlreadyMember() {
        DungeonMap map = new DungeonMap();
        map.setId(1L);
        when(mapRepository.findByJoinCode("CODE")).thenReturn(Optional.of(map));
        when(membershipRepository.existsByMapIdAndUserId(1L, 2L)).thenReturn(true);
        assertThat(service.joinMap("CODE", 2L)).isEqualTo(DungeonMapService.JoinResult.ALREADY_MEMBER);
    }

    @Test
    void joinMap_trueAndSavesMembership() {
        DungeonMap map = new DungeonMap();
        map.setId(1L);
        when(mapRepository.findByJoinCode("CODE")).thenReturn(Optional.of(map));
        when(membershipRepository.existsByMapIdAndUserId(1L, 2L)).thenReturn(false);

        assertThat(service.joinMap("CODE", 2L)).isEqualTo(DungeonMapService.JoinResult.JOINED);

        ArgumentCaptor<MapMembership> captor = ArgumentCaptor.forClass(MapMembership.class);
        verify(membershipRepository).save(captor.capture());
        assertThat(captor.getValue().getRole()).isEqualTo(MapRole.PLAYER);
    }

    @Test
    void promoteToDm_falseWhenRequesterLacksPermission() {
        when(membershipRepository.findByMapIdAndUserId(1L, 99L)).thenReturn(Optional.empty());
        assertThat(service.promoteToDm(1L, 99L, 2L)).isFalse();
    }

    @Test
    void promoteToDm_falseWhenTargetIsNotPlayer() {
        when(membershipRepository.findByMapIdAndUserId(1L, 1L))
                .thenReturn(Optional.of(membership(1L, 1L, MapRole.OWNER)));
        when(membershipRepository.findByMapIdAndUserId(1L, 2L))
                .thenReturn(Optional.of(membership(1L, 2L, MapRole.DM)));
        assertThat(service.promoteToDm(1L, 1L, 2L)).isFalse();
    }

    @Test
    void patchField_name_updatesMap() {
        DungeonMap map = new DungeonMap();
        map.setId(1L);
        map.setName("Old");
        when(mapRepository.findById(1L)).thenReturn(Optional.of(map));
        when(mapRepository.save(map)).thenReturn(map);

        Optional<DungeonMap> result = service.patchField(1L, "name", "New");

        assertThat(result).isPresent();
        assertThat(result.get().getName()).isEqualTo("New");
    }

    @Test
    void patchField_unknownField_throwsException() {
        DungeonMap map = new DungeonMap();
        when(mapRepository.findById(1L)).thenReturn(Optional.of(map));

        assertThatThrownBy(() -> service.patchField(1L, "nonexistent", "value"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void deleteMap_falseWhenNotOwner() {
        when(membershipRepository.findByMapIdAndUserId(1L, 2L)).thenReturn(Optional.empty());
        assertThat(service.deleteMap(1L, 2L)).isFalse();
    }

    @Test
    void deleteMap_falseWhenOtherMembersExist() {
        when(membershipRepository.findByMapIdAndUserId(1L, 1L))
                .thenReturn(Optional.of(membership(1L, 1L, MapRole.OWNER)));
        when(membershipRepository.countByMapId(1L)).thenReturn(2L);
        assertThat(service.deleteMap(1L, 1L)).isFalse();
    }
}
