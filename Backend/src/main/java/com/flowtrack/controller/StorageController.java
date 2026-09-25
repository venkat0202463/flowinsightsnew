package com.flowtrack.controller;

import com.flowtrack.dto.PresignedUploadRequest;
import com.flowtrack.dto.PresignedUploadResponse;
import com.flowtrack.service.S3StorageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/storage")
public class StorageController {

    @Autowired
    private S3StorageService s3StorageService;

    @PostMapping(value = "/upload", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PresignedUploadResponse> uploadFile(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @RequestParam(value = "folder", defaultValue = "attachments") String folder) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            PresignedUploadResponse response = s3StorageService.uploadFile(file, folder);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/presigned-upload-url")
    public ResponseEntity<PresignedUploadResponse> getPresignedUploadUrl(@RequestBody PresignedUploadRequest request) {
        if (request.getFilename() == null || request.getFilename().trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        PresignedUploadResponse response = s3StorageService.generatePresignedUploadUrl(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/view")
    public ResponseEntity<?> viewFile(@RequestParam(value = "key", required = false) String key,
                                      @RequestParam(value = "url", required = false) String url,
                                      @RequestParam(value = "path", required = false) String path,
                                      @RequestParam(value = "localPath", required = false) String localPath) {
        String rawTarget = (localPath != null && !localPath.isBlank()) ? localPath :
                           (path != null && !path.isBlank()) ? path :
                           (key != null && !key.isBlank()) ? key : url;
        if (rawTarget == null || rawTarget.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "key, url, or path parameter is required"));
        }

        // Clean file:/// prefix or URL encoding if present
        String cleanPath = rawTarget.replaceAll("(?i)^file:///?", "");
        try {
            cleanPath = java.net.URLDecoder.decode(cleanPath, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception ignored) {}

        // Check if local file exists on the server/host machine
        java.io.File localFile = new java.io.File(cleanPath);
        if (!localFile.exists() && !cleanPath.contains("/") && !cleanPath.contains("\\")) {
            String userHome = System.getProperty("user.home");
            if (userHome != null) {
                java.io.File inDownloads = new java.io.File(userHome, "Downloads/" + cleanPath);
                if (inDownloads.exists()) {
                    localFile = inDownloads;
                }
            }
        }

        if (localFile.exists() && localFile.isFile()) {
            try {
                org.springframework.core.io.Resource resource = new org.springframework.core.io.FileSystemResource(localFile);
                String contentType = java.nio.file.Files.probeContentType(localFile.toPath());
                if (contentType == null) {
                    contentType = localFile.getName().toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
                }
                return ResponseEntity.ok()
                        .contentType(org.springframework.http.MediaType.parseMediaType(contentType))
                        .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + localFile.getName() + "\"")
                        .body(resource);
            } catch (Exception ignored) {}
        }

        try {
            String presignedUrl = s3StorageService.generatePresignedDownloadUrl(rawTarget, java.time.Duration.ofMinutes(15));
            return ResponseEntity.status(org.springframework.http.HttpStatus.FOUND)
                    .location(java.net.URI.create(presignedUrl))
                    .build();
        } catch (Exception e) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "Failed to retrieve file from storage: " + e.getMessage()));
        }
    }

    @GetMapping("/download")
    public ResponseEntity<?> downloadFile(@RequestParam(value = "key", required = false) String key,
                                          @RequestParam(value = "url", required = false) String url,
                                          @RequestParam(value = "path", required = false) String path,
                                          @RequestParam(value = "localPath", required = false) String localPath,
                                          @RequestParam(value = "filename", required = false) String filename) {
        String rawTarget = (localPath != null && !localPath.isBlank()) ? localPath :
                           (path != null && !path.isBlank()) ? path :
                           (key != null && !key.isBlank()) ? key : url;
        if (rawTarget == null || rawTarget.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "key, url, or path parameter is required"));
        }

        String cleanPath = rawTarget.replaceAll("(?i)^file:///?", "");
        try {
            cleanPath = java.net.URLDecoder.decode(cleanPath, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception ignored) {}

        java.io.File localFile = new java.io.File(cleanPath);
        if (!localFile.exists() && !cleanPath.contains("/") && !cleanPath.contains("\\")) {
            String userHome = System.getProperty("user.home");
            if (userHome != null) {
                java.io.File inDownloads = new java.io.File(userHome, "Downloads/" + cleanPath);
                if (inDownloads.exists()) {
                    localFile = inDownloads;
                }
            }
        }

        if (localFile.exists() && localFile.isFile()) {
            try {
                org.springframework.core.io.Resource resource = new org.springframework.core.io.FileSystemResource(localFile);
                String contentType = java.nio.file.Files.probeContentType(localFile.toPath());
                if (contentType == null) {
                    contentType = localFile.getName().toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
                }
                String dlName = (filename != null && !filename.isBlank()) ? filename : localFile.getName();
                return ResponseEntity.ok()
                        .contentType(org.springframework.http.MediaType.parseMediaType(contentType))
                        .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + dlName + "\"")
                        .body(resource);
            } catch (Exception ignored) {}
        }

        try {
            String presignedUrl = s3StorageService.generatePresignedDownloadUrlWithFilename(rawTarget, filename, java.time.Duration.ofMinutes(15));
            return ResponseEntity.status(org.springframework.http.HttpStatus.FOUND)
                    .location(java.net.URI.create(presignedUrl))
                    .build();
        } catch (Exception e) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "Failed to retrieve file from storage: " + e.getMessage()));
        }
    }

    @GetMapping("/presigned-view-url")
    public ResponseEntity<?> getPresignedViewUrl(@RequestParam(value = "key", required = false) String key,
                                                 @RequestParam(value = "url", required = false) String url) {
        String target = (key != null && !key.isBlank()) ? key : url;
        if (target == null || target.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "key or url parameter is required"));
        }

        try {
            String presignedUrl = s3StorageService.generatePresignedDownloadUrl(target, java.time.Duration.ofMinutes(60));
            return ResponseEntity.ok(Map.of("url", presignedUrl));
        } catch (Exception e) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "Failed to generate presigned view URL: " + e.getMessage()));
        }
    }

    @DeleteMapping("/file")
    public ResponseEntity<?> deleteFile(@RequestParam(value = "key", required = false) String key,
                                        @RequestParam(value = "url", required = false) String url) {
        String target = (key != null && !key.isBlank()) ? key : url;
        if (target == null || target.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "key or url is required"));
        }

        s3StorageService.deleteFile(target);
        return ResponseEntity.ok(Map.of("message", "File deletion request processed"));
    }
}
