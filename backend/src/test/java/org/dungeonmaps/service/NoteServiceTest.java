package org.dungeonmaps.service;

import org.dungeonmaps.model.CellNote;
import org.dungeonmaps.model.MapNote;
import org.dungeonmaps.repository.CellNoteRepository;
import org.dungeonmaps.repository.MapNoteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NoteServiceTest {

    @Mock
    private CellNoteRepository cellNoteRepository;

    @Mock
    private MapNoteRepository mapNoteRepository;

    @InjectMocks
    private NoteService noteService;

    private static final Long MAP_ID = 1L;
    private static final Long USER_A = 10L;
    private static final Long USER_B = 20L;
    private static final int ROW = 2;
    private static final int COL = 3;

    @Test
    void getCellNotes_sharedNote_returnedForAnyMember() {
        CellNote shared = new CellNote();
        shared.setContent("Shared content");
        when(cellNoteRepository.findByMapIdAndRowIndexAndColIndexAndUserIdIsNullAndType(MAP_ID, ROW, COL, "shared"))
                .thenReturn(Optional.of(shared));
        when(cellNoteRepository.findByMapIdAndRowIndexAndColIndexAndUserIdAndType(MAP_ID, ROW, COL, USER_B, "public"))
                .thenReturn(Optional.empty());
        when(cellNoteRepository.findByMapIdAndRowIndexAndColIndexAndUserIdAndType(MAP_ID, ROW, COL, USER_B, "private"))
                .thenReturn(Optional.empty());
        when(cellNoteRepository.findByMapIdAndRowIndexAndColIndexAndTypeAndUserIdIsNotNull(MAP_ID, ROW, COL, "public"))
                .thenReturn(List.of());

        NoteService.NoteBundle bundle = noteService.getCellNotes(MAP_ID, ROW, COL, USER_B);

        assertThat(bundle.sharedContent()).isEqualTo("Shared content");
    }

    @Test
    void getCellNotes_privateNote_returnedForAuthorOnly() {
        CellNote privateNote = new CellNote();
        privateNote.setUserId(USER_A);
        privateNote.setContent("Private content");
        when(cellNoteRepository.findByMapIdAndRowIndexAndColIndexAndUserIdIsNullAndType(MAP_ID, ROW, COL, "shared"))
                .thenReturn(Optional.empty());
        when(cellNoteRepository.findByMapIdAndRowIndexAndColIndexAndUserIdAndType(MAP_ID, ROW, COL, USER_A, "public"))
                .thenReturn(Optional.empty());
        when(cellNoteRepository.findByMapIdAndRowIndexAndColIndexAndUserIdAndType(MAP_ID, ROW, COL, USER_A, "private"))
                .thenReturn(Optional.of(privateNote));
        when(cellNoteRepository.findByMapIdAndRowIndexAndColIndexAndTypeAndUserIdIsNotNull(MAP_ID, ROW, COL, "public"))
                .thenReturn(List.of());

        NoteService.NoteBundle bundle = noteService.getCellNotes(MAP_ID, ROW, COL, USER_A);

        assertThat(bundle.myPrivateContent()).isEqualTo("Private content");
    }

    @Test
    void getCellNotes_privateNote_notReturnedForOtherUser() {
        when(cellNoteRepository.findByMapIdAndRowIndexAndColIndexAndUserIdIsNullAndType(MAP_ID, ROW, COL, "shared"))
                .thenReturn(Optional.empty());
        when(cellNoteRepository.findByMapIdAndRowIndexAndColIndexAndUserIdAndType(MAP_ID, ROW, COL, USER_B, "public"))
                .thenReturn(Optional.empty());
        when(cellNoteRepository.findByMapIdAndRowIndexAndColIndexAndUserIdAndType(MAP_ID, ROW, COL, USER_B, "private"))
                .thenReturn(Optional.empty());
        when(cellNoteRepository.findByMapIdAndRowIndexAndColIndexAndTypeAndUserIdIsNotNull(MAP_ID, ROW, COL, "public"))
                .thenReturn(List.of());

        NoteService.NoteBundle bundle = noteService.getCellNotes(MAP_ID, ROW, COL, USER_B);

        assertThat(bundle.myPrivateContent()).isNull();
    }

    @Test
    void getMapNotes_privateNote_returnedForAuthorOnly() {
        MapNote privateNote = new MapNote();
        privateNote.setUserId(USER_A);
        privateNote.setContent("Map private");
        when(mapNoteRepository.findByMapIdAndUserIdIsNullAndType(MAP_ID, "shared")).thenReturn(Optional.empty());
        when(mapNoteRepository.findByMapIdAndUserIdAndType(MAP_ID, USER_A, "public")).thenReturn(Optional.empty());
        when(mapNoteRepository.findByMapIdAndUserIdAndType(MAP_ID, USER_A, "private")).thenReturn(Optional.of(privateNote));
        when(mapNoteRepository.findByMapIdAndTypeAndUserIdIsNotNull(MAP_ID, "public")).thenReturn(List.of());

        NoteService.NoteBundle bundle = noteService.getMapNotes(MAP_ID, USER_A);

        assertThat(bundle.myPrivateContent()).isEqualTo("Map private");
    }

    @Test
    void getMapNotes_privateNote_notReturnedForOtherUser() {
        when(mapNoteRepository.findByMapIdAndUserIdIsNullAndType(MAP_ID, "shared")).thenReturn(Optional.empty());
        when(mapNoteRepository.findByMapIdAndUserIdAndType(MAP_ID, USER_B, "public")).thenReturn(Optional.empty());
        when(mapNoteRepository.findByMapIdAndUserIdAndType(MAP_ID, USER_B, "private")).thenReturn(Optional.empty());
        when(mapNoteRepository.findByMapIdAndTypeAndUserIdIsNotNull(MAP_ID, "public")).thenReturn(List.of());

        NoteService.NoteBundle bundle = noteService.getMapNotes(MAP_ID, USER_B);

        assertThat(bundle.myPrivateContent()).isNull();
    }
}
