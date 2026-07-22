import { getAuth } from 'firebase/auth';

interface DownloadOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
  fallbackFilename?: string;
}

/**
 * Parses the Content-Disposition header to extract the filename sent by the server.
 */
function getFilenameFromContentDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;

  // Check for UTF-8 encoded filename (e.g. filename*=UTF-8''filename.pdf)
  const utf8Matches = /filename\*=UTF-8''([^;\r\n]+)/i.exec(header);
  if (utf8Matches && utf8Matches[1]) {
    try {
      return decodeURIComponent(utf8Matches[1]);
    } catch {
      // ignore decode error and try standard match
    }
  }

  // Check for standard filename="filename.pdf" or filename=filename.pdf
  const matches = /filename="?([^";\r\n]+)"?/i.exec(header);
  if (matches && matches[1]) {
    return matches[1].trim();
  }

  return fallback;
}

/**
 * Downloads a binary stream (e.g. PDF) from a server URL by converting the response to a Blob.
 * Handles Firebase Auth ID Tokens, Content-Disposition filenames, and Blob Object URL creation
 * to ensure consistent, reliable file downloads across all modern desktop and mobile browsers.
 */
export async function downloadPdfStream(url: string, filename?: string, options: DownloadOptions = {}): Promise<void> {
  const { method = 'GET', headers = {}, body, fallbackFilename = 'MissionGrid_Study_Material.pdf' } = options;
  const targetFilename = filename || fallbackFilename;

  // 1. Retrieve current Firebase Auth Token if available
  let authHeader = '';
  try {
    const auth = getAuth();
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      authHeader = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn('[downloadPdfStream] Auth token fetch skipped:', err);
  }

  const requestHeaders: Record<string, string> = { ...headers };
  if (authHeader && !requestHeaders['Authorization']) {
    requestHeaders['Authorization'] = authHeader;
  }

  // 2. Request binary PDF stream from server
  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const json = await response.json();
      if (json.error) errorMsg = json.error;
    } catch {
      // Non-JSON error body
    }
    throw new Error(errorMsg);
  }

  // 3. Extract server-provided filename or use requested filename
  const contentDisposition = response.headers.get('Content-Disposition');
  const serverFilename = getFilenameFromContentDisposition(contentDisposition, targetFilename);

  // 4. Read response stream as Blob
  const rawBlob = await response.blob();
  const pdfBlob = new Blob([rawBlob], { type: 'application/pdf' });

  // 5. Trigger download using object URL and invisible anchor
  const windowUrl = window.URL || (window as any).webkitURL;
  const blobUrl = windowUrl.createObjectURL(pdfBlob);

  const downloadAnchor = document.createElement('a');
  downloadAnchor.style.display = 'none';
  downloadAnchor.href = blobUrl;
  downloadAnchor.download = serverFilename;
  downloadAnchor.rel = 'noopener noreferrer';

  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();

  // 6. Cleanup DOM and Object URL memory
  setTimeout(() => {
    if (document.body.contains(downloadAnchor)) {
      document.body.removeChild(downloadAnchor);
    }
    windowUrl.revokeObjectURL(blobUrl);
  }, 10000);
}
