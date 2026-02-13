package org.dungeonmaps.DungeonMapster.service;

import org.dungeonmaps.DungeonMapster.model.DungeonMap;
import org.dungeonmaps.DungeonMapster.repository.DungeonMapRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class DungeonMapService {

    private final DungeonMapRepository repository;

    public DungeonMapService(DungeonMapRepository repository) {
        this.repository = repository;
    }

    public List<DungeonMap> getAllMaps() {
        return repository.findAll();
    }

    public Optional<DungeonMap> getMapById(Long id) {
        return repository.findById(id);
    }

    public DungeonMap saveMap(DungeonMap map) {
        return repository.save(map);
    }

    public void deleteMap(Long id) {
        repository.deleteById(id);
    }
}