package com.flowtrack.dto;

public class PresignedUploadRequest {
    private String filename;
    private String contentType;
    private String folder = "attachments";

    public PresignedUploadRequest() {}

    public PresignedUploadRequest(String filename, String contentType, String folder) {
        this.filename = filename;
        this.contentType = contentType;
        this.folder = folder;
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

    public String getFolder() {
        return folder;
    }

    public void setFolder(String folder) {
        this.folder = folder;
    }
}
