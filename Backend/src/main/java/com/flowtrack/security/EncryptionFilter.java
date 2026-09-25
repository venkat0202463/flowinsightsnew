package com.flowtrack.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;

@Component
public class EncryptionFilter extends OncePerRequestFilter {

    private final EncryptionUtils encryptionUtils;
    private final ObjectMapper objectMapper;

    @org.springframework.beans.factory.annotation.Value("${flowtrack.skip-payload-encryption:${SKIP_PAYLOAD_ENCRYPTION:false}}")
    private boolean globalSkipPayloadEncryption;

    public EncryptionFilter(EncryptionUtils encryptionUtils) {
        this.encryptionUtils = encryptionUtils;
        this.objectMapper = new ObjectMapper();
    }

    private boolean isSkipRequested(HttpServletRequest request) {
        if (globalSkipPayloadEncryption) {
            return true;
        }
        // Check headers
        String h1 = request.getHeader("skip-payload-encryption");
        String h2 = request.getHeader("vite-skip-payload-encryption");
        String h3 = request.getHeader("X-Skip-Payload-Encryption");
        String h4 = request.getHeader("x-skip-payload-encryption");
        if ("true".equalsIgnoreCase(h1) || "true".equalsIgnoreCase(h2) || "true".equalsIgnoreCase(h3) || "true".equalsIgnoreCase(h4)) {
            return true;
        }

        // Check query parameters
        String p1 = request.getParameter("skip-payload-encryption");
        String p2 = request.getParameter("vite-skip-payload-encryption");
        String p3 = request.getParameter("skipPayloadEncryption");
        return "true".equalsIgnoreCase(p1) || "true".equalsIgnoreCase(p2) || "true".equalsIgnoreCase(p3);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        // Only process JSON requests
        String contentType = request.getContentType();
        boolean isJsonRequest = contentType != null && contentType.toLowerCase().contains("application/json");
        
        HttpServletRequest requestToUse = request;

        if (isJsonRequest && !request.getMethod().equalsIgnoreCase("GET")) {
            String requestBody = request.getReader().lines().collect(Collectors.joining(System.lineSeparator()));
            if (requestBody != null && !requestBody.trim().isEmpty()) {
                try {
                    JsonNode node = objectMapper.readTree(requestBody);
                    if (node.has("payload") && node.get("payload").isTextual()) {
                        String encryptedPayload = node.get("payload").asText();
                        String decryptedBody = encryptionUtils.decrypt(encryptedPayload);
                        requestToUse = new DecryptedRequestWrapper(request, decryptedBody);
                    } else {
                        requestToUse = new DecryptedRequestWrapper(request, requestBody); // Pass through raw JSON
                    }
                } catch (Exception e) {
                    // Fallback pass through
                    requestToUse = new DecryptedRequestWrapper(request, requestBody);
                }
            }
        }

        ContentCachingResponseWrapper responseWrapper = new ContentCachingResponseWrapper(response);

        filterChain.doFilter(requestToUse, responseWrapper);

        // Process Response
        String responseContentType = responseWrapper.getContentType();
        boolean isJsonResponse = responseContentType != null && responseContentType.toLowerCase().contains("application/json");

        if (isJsonResponse) {
            byte[] responseArray = responseWrapper.getContentAsByteArray();
            String responseStr = new String(responseArray, StandardCharsets.UTF_8);

            if (!responseStr.isEmpty()) {
                if (isSkipRequested(request)) {
                    // Skip encryption requested (e.g. API automation or vite-skip-payload-encryption = true)
                    // If response is wrapped in { "payload": "..." }, decrypt it so client receives plain JSON
                    try {
                        JsonNode node = objectMapper.readTree(responseStr);
                        if (node.has("payload") && node.get("payload").isTextual()) {
                            String decryptedStr = encryptionUtils.decrypt(node.get("payload").asText());
                            byte[] decryptedBytes = decryptedStr.getBytes(StandardCharsets.UTF_8);
                            responseWrapper.resetBuffer();
                            responseWrapper.getOutputStream().write(decryptedBytes);
                            response.setContentLength(decryptedBytes.length);
                            if (response.containsHeader("Content-Length")) {
                                response.setHeader("Content-Length", String.valueOf(decryptedBytes.length));
                            }
                        }
                    } catch (Exception e) {
                        // Keep response as plain text/JSON if parsing fails
                    }
                } else {
                    // Default behavior: encrypt response body into { "payload": "..." }
                    try {
                        String encryptedResponse = encryptionUtils.encrypt(responseStr);
                        ObjectNode payloadNode = objectMapper.createObjectNode();
                        payloadNode.put("payload", encryptedResponse);
                        
                        byte[] encryptedBytes = objectMapper.writeValueAsBytes(payloadNode);
                        responseWrapper.resetBuffer();
                        responseWrapper.setContentLength(encryptedBytes.length);
                        responseWrapper.getOutputStream().write(encryptedBytes);

                        // Fix Content-Length header
                        response.setContentLength(encryptedBytes.length);
                        if (response.containsHeader("Content-Length")) {
                            response.setHeader("Content-Length", String.valueOf(encryptedBytes.length));
                        }
                    } catch (Exception e) {
                        // Fallback on error
                    }
                }
            }
        }
        
        responseWrapper.copyBodyToResponse();
    }

    private static class DecryptedRequestWrapper extends HttpServletRequestWrapper {
        private final byte[] body;

        public DecryptedRequestWrapper(HttpServletRequest request, String decryptedBody) {
            super(request);
            this.body = decryptedBody.getBytes(StandardCharsets.UTF_8);
        }

        @Override
        public ServletInputStream getInputStream() {
            final ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override
                public boolean isFinished() {
                    return byteArrayInputStream.available() == 0;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener readListener) {
                }

                @Override
                public int read() {
                    return byteArrayInputStream.read();
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(new InputStreamReader(this.getInputStream(), StandardCharsets.UTF_8));
        }
        
        @Override
        public int getContentLength() {
            return body.length;
        }

        @Override
        public long getContentLengthLong() {
            return body.length;
        }
    }
}
