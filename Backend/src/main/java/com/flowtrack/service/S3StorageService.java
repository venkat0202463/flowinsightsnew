package com.flowtrack.service;

import com.flowtrack.dto.PresignedUploadRequest;
import com.flowtrack.dto.PresignedUploadResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
public class S3StorageService {

    private static final Logger log = LoggerFactory.getLogger(S3StorageService.class);

    @Autowired
    private S3Presigner s3Presigner;

    @Autowired
    private S3Client s3Client;

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    @Value("${aws.s3.region}")
    private String region;

    private static final Duration UPLOAD_URL_EXPIRATION = Duration.ofMinutes(15);

    public PresignedUploadResponse uploadFile(org.springframework.web.multipart.MultipartFile file, String folder) throws java.io.IOException {
        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename().trim() : "file";
        String contentType = file.getContentType() != null && !file.getContentType().isBlank()
                ? file.getContentType()
                : "application/octet-stream";
        String folderPrefix = folder != null && !folder.isBlank()
                ? folder.trim().replaceAll("^/+|/+$", "")
                : "attachments";

        String sanitizedFilename = originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (sanitizedFilename.isEmpty()) {
            sanitizedFilename = "upload";
        }

        LocalDate now = LocalDate.now();
        String datePath = now.format(DateTimeFormatter.ofPattern("yyyy/MM"));
        String fileKey = String.format("%s/%s/%s-%s", folderPrefix, datePath, UUID.randomUUID(), sanitizedFilename);

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(fileKey)
                .contentType(contentType)
                .build();

        s3Client.putObject(putObjectRequest, software.amazon.awssdk.core.sync.RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

        String fileUrl = String.format("https://%s.s3.%s.amazonaws.com/%s", bucketName, region, fileKey);
        log.info("[S3] Direct upload successful for key: {} in bucket: {}", fileKey, bucketName);

        return new PresignedUploadResponse(fileUrl, fileUrl, fileKey, originalFilename, contentType);
    }

    public PresignedUploadResponse generatePresignedUploadUrl(PresignedUploadRequest request) {
        String originalFilename = request.getFilename() != null ? request.getFilename().trim() : "file";
        String contentType = request.getContentType() != null && !request.getContentType().isBlank() 
                ? request.getContentType() 
                : "application/octet-stream";
        String folder = request.getFolder() != null && !request.getFolder().isBlank() 
                ? request.getFolder().trim().replaceAll("^/+|/+$", "") 
                : "attachments";

        // Sanitize filename
        String sanitizedFilename = originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (sanitizedFilename.isEmpty()) {
            sanitizedFilename = "upload";
        }

        // Generate partition path: folder/yyyy/MM/uuid-filename
        LocalDate now = LocalDate.now();
        String datePath = now.format(DateTimeFormatter.ofPattern("yyyy/MM"));
        String fileKey = String.format("%s/%s/%s-%s", folder, datePath, UUID.randomUUID(), sanitizedFilename);

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(fileKey)
                .contentType(contentType)
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(UPLOAD_URL_EXPIRATION)
                .putObjectRequest(putObjectRequest)
                .build();

        PresignedPutObjectRequest presignedPutObjectRequest = s3Presigner.presignPutObject(presignRequest);
        String uploadUrl = presignedPutObjectRequest.url().toString();

        // Build permanent S3 URL
        String fileUrl = String.format("https://%s.s3.%s.amazonaws.com/%s", bucketName, region, fileKey);

        log.info("[S3] Generated presigned upload URL for key: {} in bucket: {}", fileKey, bucketName);

        return new PresignedUploadResponse(uploadUrl, fileUrl, fileKey, originalFilename, contentType);
    }

    public void deleteFile(String fileKeyOrUrl) {
        if (fileKeyOrUrl == null || fileKeyOrUrl.isBlank()) {
            return;
        }

        String fileKey = extractKeyFromUrl(fileKeyOrUrl);
        try {
            DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(fileKey)
                    .build();

            s3Client.deleteObject(deleteObjectRequest);
            log.info("[S3] Deleted S3 object: {} from bucket: {}", fileKey, bucketName);
        } catch (Exception e) {
            log.error("[S3] Failed to delete S3 object: " + fileKey, e);
        }
    }

    public String generatePresignedDownloadUrl(String fileKeyOrUrl, Duration duration) {
        return generatePresignedDownloadUrlWithFilename(fileKeyOrUrl, null, duration);
    }

    public String generatePresignedDownloadUrlWithFilename(String fileKeyOrUrl, String customFilename, Duration duration) {
        if (fileKeyOrUrl == null || fileKeyOrUrl.isBlank()) {
            return null;
        }

        String fileKey = extractKeyFromUrl(fileKeyOrUrl);
        // Strip any #filename or ?query from key if present
        int hashIdx = fileKey.indexOf('#');
        if (hashIdx != -1) {
            fileKey = fileKey.substring(0, hashIdx);
        }
        int queryIdx = fileKey.indexOf('?');
        if (queryIdx != -1) {
            fileKey = fileKey.substring(0, queryIdx);
        }

        try {
            GetObjectRequest.Builder getObjectRequestBuilder = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(fileKey);

            if (customFilename != null && !customFilename.isBlank()) {
                // Normalize all Unicode whitespace (e.g. \u202F Narrow No-Break Space from macOS screenshots, \u00A0 Non-Breaking Space)
                String normalized = customFilename
                        .replace('\u202F', ' ')
                        .replace('\u00A0', ' ')
                        .replace('\u200B', ' ')
                        .trim();

                // ASCII-safe fallback for standard ISO-8859-1 Content-Disposition
                String asciiFilename = normalized
                        .replaceAll("[^\\x20-\\x7E]", "_")
                        .replaceAll("[\"\\r\\n;\\\\]", "")
                        .trim();
                if (asciiFilename.isEmpty()) {
                    asciiFilename = "download";
                }

                // RFC 5987 / RFC 6266 UTF-8 encoded filename parameter for full Unicode support
                String utf8Encoded = java.net.URLEncoder.encode(normalized, java.nio.charset.StandardCharsets.UTF_8)
                        .replace("+", "%20");

                String contentDisposition = String.format("attachment; filename=\"%s\"; filename*=UTF-8''%s", asciiFilename, utf8Encoded);
                getObjectRequestBuilder.responseContentDisposition(contentDisposition);
            }

            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(duration != null ? duration : Duration.ofMinutes(15))
                    .getObjectRequest(getObjectRequestBuilder.build())
                    .build();

            PresignedGetObjectRequest presignedGetObjectRequest = s3Presigner.presignGetObject(presignRequest);
            String presignedUrl = presignedGetObjectRequest.url().toString();
            log.info("[S3] Generated presigned GET URL for key: {} in bucket: {}", fileKey, bucketName);
            return presignedUrl;
        } catch (Exception e) {
            log.error("[S3] Failed to generate presigned GET URL for key: " + fileKey, e);
            throw new RuntimeException("Failed to generate presigned URL", e);
        }
    }

    private String extractKeyFromUrl(String urlOrKey) {
        if (!urlOrKey.startsWith("http://") && !urlOrKey.startsWith("https://")) {
            return urlOrKey;
        }

        // Extract key after amazonaws.com/
        int amazonIndex = urlOrKey.indexOf(".amazonaws.com/");
        if (amazonIndex != -1) {
            return urlOrKey.substring(amazonIndex + ".amazonaws.com/".length());
        }

        // Fallback: extract after last single domain slash
        int thirdSlash = urlOrKey.indexOf('/', 8);
        if (thirdSlash != -1) {
            return urlOrKey.substring(thirdSlash + 1);
        }

        return urlOrKey;
    }
}
