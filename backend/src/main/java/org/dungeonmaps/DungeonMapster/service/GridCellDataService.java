package org.dungeonmaps.DungeonMapster.service;

import org.dungeonmaps.DungeonMapster.model.GridCellData;
import org.dungeonmaps.DungeonMapster.repository.GridCellDataRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class GridCellDataService {
    @Autowired
    private GridCellDataRepository repository;

    public GridCellData saveOrUpdate(Long mapId, Integer row, Integer col, String name) {
        GridCellData cellData = repository.findByMapIdAndRowIndexAndColIndex(mapId, row, col)
                .orElse(new GridCellData());

        cellData.setMapId(mapId);
        cellData.setRowIndex(row);
        cellData.setColIndex(col);
        cellData.setName(name);

        return repository.save(cellData);
    }

    public GridCellData getCell(Long mapId, Integer row, Integer col) {
        return repository.findByMapIdAndRowIndexAndColIndex(mapId, row, col)
                .orElse(null);
    }
}