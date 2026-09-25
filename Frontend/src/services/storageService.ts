import DOMPurify from 'dompurify';
import api from './api';

export interface StorageUploadResponse {
  uploadUrl?: string;
  fileUrl: string;
  fileKey: string;
  filename: string;
  contentType: string;
}

/**
 * Uploads a file to Amazon S3 via the Backend server.
 * Eliminates browser-to-S3 CORS requirements completely.
 * 
 * @param file The File object to upload
 * @param folder The S3 folder prefix (e.g. 'attachments', 'avatars', 'releases')
 * @returns Object containing the permanent S3 fileUrl, fileKey, and filename
 */
export const uploadFileToS3 = async (
  file: File,
  folder: string = 'attachments'
): Promise<{ fileUrl: string; fileKey: string; filename: string }> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const { data } = await api.post<StorageUploadResponse>('/storage/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'skip-payload-encryption': 'true',
      },
    });

    if (!data || !data.fileUrl) {
      throw new Error('Failed to upload file to S3 via backend server');
    }

    return {
      fileUrl: data.fileUrl,
      fileKey: data.fileKey,
      filename: data.filename || file.name,
    };
  } catch (error) {
    console.error('Error uploading file to S3 via backend proxy:', error);
    throw error;
  }
};

/**
 * Converts any S3 URL or object key to an authenticated / secure backend view endpoint URL.
 * Enables zero-lag image rendering and viewing on private S3 buckets.
 */
export const getStorageViewUrl = (urlOrKey?: string | null): string => {
  if (!urlOrKey) return '';
  if (urlOrKey.startsWith('data:') || urlOrKey.startsWith('blob:')) return urlOrKey;

  // Remove any local filename hash (e.g. https://...#MyFile.png)
  let clean = urlOrKey;
  const hashIdx = clean.indexOf('#');
  if (hashIdx !== -1) {
    clean = clean.substring(0, hashIdx);
  }

  // If already routed to backend storage view, return as is
  if (clean.includes('/storage/view?key=')) {
    return clean;
  }

  const apiBase = api.defaults.baseURL || '/api';
  return `${apiBase}/storage/view?key=${encodeURIComponent(clean)}`;
};

/**
 * Converts any S3 URL or object key to an authenticated / secure backend download URL with attachment header.
 */
export const getStorageDownloadUrl = (urlOrKey?: string | null, filename?: string): string => {
  if (!urlOrKey) return '';
  if (urlOrKey.startsWith('data:') || urlOrKey.startsWith('blob:')) return urlOrKey;

  let clean = urlOrKey;
  const hashIdx = clean.indexOf('#');
  if (hashIdx !== -1) {
    clean = clean.substring(0, hashIdx);
  }

  const apiBase = api.defaults.baseURL || '/api';
  const nameParam = filename ? `&filename=${encodeURIComponent(filename)}` : '';
  return `${apiBase}/storage/download?key=${encodeURIComponent(clean)}${nameParam}`;
};

/**
 * Replaces direct raw Amazon S3 URLs in HTML (e.g. comments, descriptions)
 * with the secure backend view endpoint so all embedded images render properly.
 */
export const transformStorageUrlsInHtml = (html?: string | null): string => {
  if (!html) return '';
  
  // Replace direct S3 URLs in src="..." or href="..."
  return html.replace(/(https?:\/\/[a-zA-Z0-9.\-_]+\.s3\.[a-zA-Z0-9.\-_]+\.amazonaws\.com\/[^\s"'<>]+)/g, (match) => {
    return getStorageViewUrl(match);
  });
};

/**
 * Auto-links raw plain text URLs into proper <a> anchor tags without affecting existing HTML tags.
 */
export const autoLinkText = (html?: string | null): string => {
  if (!html) return '';
  // Split HTML into existing tags (including <a>...</a>) and plain text chunks
  const parts = html.split(/(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>)/gi);
  return parts
    .map((part) => {
      // If it's an HTML tag or already an <a> element, preserve it as-is
      if (!part || part.startsWith('<')) {
        return part;
      }
      // Auto-link valid URLs or file paths in raw text
      return part.replace(/(file:\/\/\/[^\s<"']+|https?:\/\/[^\s<"']+|www\.[^\s<"']+)/g, (match) => {
        const href = match.startsWith('www.') ? `https://${match}` : match;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer">${match}</a>`;
      });
    })
    .join('');
};

/**
 * Robustly sanitizes rich HTML ensuring all links, images, data URIs, and file downloads are preserved.
 */
export const sanitizeRichHtml = (html?: string | null): string => {
  if (!html) return '';
  const transformed = transformStorageUrlsInHtml(autoLinkText(html));
  return DOMPurify.sanitize(transformed, {
    ADD_TAGS: ['iframe', 'embed'],
    ADD_ATTR: [
      'src',
      'href',
      'style',
      'controls',
      'target',
      'rel',
      'download',
      'contenteditable',
      'data-filename',
      'data-user-id',
      'data-emp-id',
      'data-email',
      'class'
    ],
    ALLOW_DATA_ATTR: true,
    ADD_DATA_URI_TAGS: ['a', 'img', 'embed', 'iframe'],
  });
};

/**
 * Universally opens or downloads links, data URIs, blob URIs, local file links, PDFs, and storage attachments.
 */
export const handleOpenLink = async (href?: string | null, filename?: string, taskAttachments?: string[]) => {
  if (!href) return;

  let trimmedHref = href.trim();
  if (!trimmedHref || trimmedHref === '#' || trimmedHref.startsWith('javascript:')) return;

  // Clean markdown or quotation wrappers
  trimmedHref = trimmedHref.replace(/^<|>$/g, '').replace(/^['"]|['"]$/g, '');

  const apiBase = api.defaults.baseURL || `${window.location.origin}/api`;
  const cleanBase = apiBase.replace(/\/api\/?$/, '');

  // Check if filename or href matches any attachment in taskAttachments
  if (taskAttachments && taskAttachments.length > 0) {
    const searchName = (filename || trimmedHref || '').toLowerCase();
    const cleanSearchName = decodeURIComponent(searchName.split('/').pop() || searchName).trim();
    const matched = taskAttachments.find(att => {
      const attName = decodeURIComponent(att.split('/').pop() || '').toLowerCase();
      return attName.includes(cleanSearchName) || cleanSearchName.includes(attName) || att.toLowerCase().includes(cleanSearchName);
    });
    if (matched) {
      trimmedHref = matched;
    }
  }

  // 1. Data URLs (e.g. data:application/pdf;base64,...)
  if (trimmedHref.startsWith('data:')) {
    try {
      const commaIndex = trimmedHref.indexOf(',');
      if (commaIndex !== -1) {
        const header = trimmedHref.substring(0, commaIndex);
        const base64Data = trimmedHref.substring(commaIndex + 1);
        const mimeMatch = header.match(/data:([^;]+)/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        
        const isBase64 = header.includes(';base64');
        let blob: Blob;
        if (isBase64) {
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: mime });
        } else {
          blob = new Blob([decodeURIComponent(base64Data)], { type: mime });
        }

        const blobUrl = URL.createObjectURL(blob);
        const isPdfOrImage = mime === 'application/pdf' || mime.startsWith('image/');
        
        if (isPdfOrImage) {
          window.open(blobUrl, '_blank');
        } else {
          const a = document.createElement('a');
          a.href = blobUrl;
          if (filename) a.download = filename;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
        return;
      }
    } catch (err) {
      console.error('Failed to parse data URL into blob:', err);
    }
  }

  // 2. Blob URLs
  if (trimmedHref.startsWith('blob:')) {
    window.open(trimmedHref, '_blank');
    return;
  }

  // 3. Local file or backend storage view URL
  let targetEndpoint = '';
  if (trimmedHref.startsWith('file:') || /^[a-zA-Z]:[/\\]/.test(trimmedHref)) {
    const cleanPath = trimmedHref.replace(/^file:\/\/\/?/i, '');
    targetEndpoint = `/storage/view?path=${encodeURIComponent(cleanPath)}`;
  } else if (trimmedHref.startsWith('/api/storage/')) {
    targetEndpoint = trimmedHref.replace(/^\/api/, '');
  } else if (trimmedHref.startsWith('/storage/')) {
    targetEndpoint = trimmedHref;
  } else if (
    trimmedHref.includes('.') &&
    !trimmedHref.includes('://') &&
    (trimmedHref.endsWith('.pdf') ||
      trimmedHref.endsWith('.png') ||
      trimmedHref.endsWith('.jpg') ||
      trimmedHref.endsWith('.jpeg') ||
      trimmedHref.endsWith('.docx') ||
      trimmedHref.endsWith('.xlsx') ||
      trimmedHref.endsWith('.zip'))
  ) {
    targetEndpoint = `/storage/view?key=${encodeURIComponent(trimmedHref)}`;
  }

  // If we have a backend storage endpoint, fetch via blob to bypass CSP/browser restrictions
  if (targetEndpoint) {
    try {
      const res = await api.get(targetEndpoint, { responseType: 'blob' });
      const contentType = String(res.headers['content-type'] || 'application/pdf');
      const blob = new Blob([res.data], { type: contentType });
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
      return;
    } catch (err) {
      console.warn('Direct blob stream failed, falling back to direct window.open:', err);
      const fullFallback = `${cleanBase}${targetEndpoint.startsWith('/') ? targetEndpoint : '/' + targetEndpoint}`;
      window.open(fullFallback, '_blank');
      return;
    }
  }

  // 4. Resolve full external URLs
  let fullUrl = trimmedHref;
  if (trimmedHref.includes('.s3.') && trimmedHref.includes('.amazonaws.com/')) {
    fullUrl = `${apiBase}/storage/view?key=${encodeURIComponent(trimmedHref)}`;
  } else if (!trimmedHref.includes('://') && !trimmedHref.startsWith('mailto:') && !trimmedHref.startsWith('tel:')) {
    fullUrl = `https://${trimmedHref}`;
  }

  // 5. Open in new tab or trigger download
  if (filename && !fullUrl.includes('/storage/view')) {
    const a = document.createElement('a');
    a.href = fullUrl;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    const win = window.open(fullUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      const a = document.createElement('a');
      a.href = fullUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }
};

/**
 * Requests backend to delete a file from Amazon S3.
 * 
 * @param urlOrKey The S3 URL or S3 object key to delete
 */
export const deleteFileFromS3 = async (urlOrKey: string): Promise<void> => {
  if (!urlOrKey) return;
  try {
    await api.delete('/storage/file', {
      params: { url: urlOrKey }
    });
  } catch (error) {
    console.error('Error deleting file from S3:', error);
  }
};


