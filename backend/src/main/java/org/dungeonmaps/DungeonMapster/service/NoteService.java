package org.dungeonmaps.DungeonMapster.service;

import org.dungeonmaps.DungeonMapster.model.CellNote;
import org.dungeonmaps.DungeonMapster.model.MapNote;
import org.dungeonmaps.DungeonMapster.repository.CellNoteRepository;
import org.dungeonmaps.DungeonMapster.repository.MapNoteRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NoteService {

    private final CellNoteRepository cellNoteRepository;
    private final MapNoteRepository mapNoteRepository;

    public NoteService(CellNoteRepository cellNoteRepository, MapNoteRepository mapNoteRepository) {
        this.cellNoteRepository = cellNoteRepository;
        this.mapNoteRepository = mapNoteRepository;
    }

    public record OtherPublicNote(Long userId, String content) {}

    public record NoteBundle(
            String sharedContent,
            String myPublicContent,
            String myPrivateContent,
            List<OtherPublicNote> othersPublic
    ) {}

    public NoteBundle getCellNotes(Long mapId, int row, int col, Long userId) {
        String shared = cellNoteRepository
                .findByMapIdAndRowIndexAndColIndexAndUserIdIsNullAndType(mapId, row, col, "shared")
                .map(CellNote::getContent).orElse(null);

        String myPublic = cellNoteRepository
                .findByMapIdAndRowIndexAndColIndexAndUserIdAndType(mapId, row, col, userId, "public")
                .map(CellNote::getContent).orElse(null);

        String myPrivate = cellNoteRepository
                .findByMapIdAndRowIndexAndColIndexAndUserIdAndType(mapId, row, col, userId, "private")
                .map(CellNote::getContent).orElse(null);

        List<OtherPublicNote> others = cellNoteRepository
                .findByMapIdAndRowIndexAndColIndexAndTypeAndUserIdIsNotNull(mapId, row, col, "public")
                .stream()
                .filter(n -> !n.getUserId().equals(userId))
                .map(n -> new OtherPublicNote(n.getUserId(), n.getContent()))
                .toList();

        return new NoteBundle(shared, myPublic, myPrivate, others);
    }

    public void saveCellNote(Long mapId, int row, int col, Long userId, String type, String content) {
        if ("shared".equals(type)) {
            CellNote note = cellNoteRepository
                    .findByMapIdAndRowIndexAndColIndexAndUserIdIsNullAndType(mapId, row, col, type)
                    .orElseGet(() -> {
                        CellNote n = new CellNote();
                        n.setMapId(mapId);
                        n.setRowIndex(row);
                        n.setColIndex(col);
                        n.setUserId(null);
                        n.setType(type);
                        return n;
                    });
            note.setContent(content);
            cellNoteRepository.save(note);
        } else {
            CellNote note = cellNoteRepository
                    .findByMapIdAndRowIndexAndColIndexAndUserIdAndType(mapId, row, col, userId, type)
                    .orElseGet(() -> {
                        CellNote n = new CellNote();
                        n.setMapId(mapId);
                        n.setRowIndex(row);
                        n.setColIndex(col);
                        n.setUserId(userId);
                        n.setType(type);
                        return n;
                    });
            note.setContent(content);
            cellNoteRepository.save(note);
        }
    }

    public NoteBundle getMapNotes(Long mapId, Long userId) {
        String shared = mapNoteRepository
                .findByMapIdAndUserIdIsNullAndType(mapId, "shared")
                .map(MapNote::getContent).orElse(null);

        String myPublic = mapNoteRepository
                .findByMapIdAndUserIdAndType(mapId, userId, "public")
                .map(MapNote::getContent).orElse(null);

        String myPrivate = mapNoteRepository
                .findByMapIdAndUserIdAndType(mapId, userId, "private")
                .map(MapNote::getContent).orElse(null);

        List<OtherPublicNote> others = mapNoteRepository
                .findByMapIdAndTypeAndUserIdIsNotNull(mapId, "public")
                .stream()
                .filter(n -> !n.getUserId().equals(userId))
                .map(n -> new OtherPublicNote(n.getUserId(), n.getContent()))
                .toList();

        return new NoteBundle(shared, myPublic, myPrivate, others);
    }

    public void saveMapNote(Long mapId, Long userId, String type, String content) {
        if ("shared".equals(type)) {
            MapNote note = mapNoteRepository
                    .findByMapIdAndUserIdIsNullAndType(mapId, type)
                    .orElseGet(() -> {
                        MapNote n = new MapNote();
                        n.setMapId(mapId);
                        n.setUserId(null);
                        n.setType(type);
                        return n;
                    });
            note.setContent(content);
            mapNoteRepository.save(note);
        } else {
            MapNote note = mapNoteRepository
                    .findByMapIdAndUserIdAndType(mapId, userId, type)
                    .orElseGet(() -> {
                        MapNote n = new MapNote();
                        n.setMapId(mapId);
                        n.setUserId(userId);
                        n.setType(type);
                        return n;
                    });
            note.setContent(content);
            mapNoteRepository.save(note);
        }
    }
}
