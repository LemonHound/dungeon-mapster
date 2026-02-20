package org.dungeonmaps.DungeonMapster.controller;

import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/upload")
public class FileUploadController {

    private final Storage storage;

    @Value("${gcs.bucket-name}")
    private String bucketName;

    public FileUploadController(Storage storage) {
        this.storage = storage;
    }

    @PostMapping("/image")
    public ResponseEntity<Map<String, String>> uploadImage(@RequestParam("file") MultipartFile file) {
        try {
            String filename = UUID.randomUUID() + "_" + file.getOriginalFilename().replaceAll("[^a-zA-Z0-9.-]", "_");
            BlobId blobId = BlobId.of(bucketName, "maps/" + filename);
            BlobInfo blobInfo = BlobInfo.newBuilder(blobId)
                    .setContentType(file.getContentType())
                    .build();
            storage.create(blobInfo, file.getBytes());
            return ResponseEntity.ok(Map.of("imageUrl", filename));
        } catch (IOException e) {
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/image/{filename:.+}")
    public ResponseEntity<byte[]> getImage(@PathVariable String filename) {
        byte[] bytes = storage.readAllBytes(bucketName, "maps/" + filename);
        if (bytes == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
                .body(bytes);
    }
}