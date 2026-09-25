package com.flowtrack.dto;

public class PresignedUploadResponse {
    private String uploadUrl;
    private String fileUrl;
    private String fileKey;
    private String filename;
    private String contentType;

    public PresignedUploadResponse() {}

    public PresignedUploadResponse(String uploadUrl, String fileUrl, String fileKey, String filename, String contentType) {
        this.uploadUrl = uploadUrl;
        this.fileUrl = fileUrl;
        this.fileKey = fileKey;
        this.filename = filename;
        this.contentType = contentType;
    }

    public String getUploadUrl() {
        return uploadUrl;
    }

    public void setUploadUrl(String uploadUrl) {
        this.uploadUrl = uploadUrl;
    }

    public String getFileUrl() {
        return fileUrl;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }

    public String getFileKey() {
        return fileKey;
    }

    public void setFileKey(String fileKey) {
        this.fileKey = fileKey;
    }

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }
}
