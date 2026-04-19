import api from './api';

let preflightOk = null;
let preflightInFlight = null;

const guessMime = (filename) => {
  const m = /\.(\w+)$/.exec(filename || '');
  if (!m) return 'application/octet-stream';
  const ext = m[1].toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'pdf') return 'application/pdf';
  return `application/${ext}`;
};

/**
 * Upload a single media file to /api/media/upload.
 *
 * IMPORTANT: do NOT pass `Content-Type: multipart/form-data` manually. The
 * RN FormData polyfill needs to set the boundary itself. Setting it manually
 * blanks the boundary on iOS and causes silent upload failures.
 */
export async function uploadMedia({ uri, name, mimeType, entityType, entityId, category, mediaType = 'document' }) {
  if (!uri) throw new Error('uploadMedia: uri is required');
  const filename = name || uri.split('/').pop() || 'file';
  const type = mimeType || guessMime(filename);

  const formData = new FormData();
  formData.append('file', { uri, name: filename, type });
  if (entityType) formData.append('entityType', entityType);
  if (entityId) formData.append('entityId', entityId);
  if (category) formData.append('category', category);
  formData.append('mediaType', mediaType);

  try {
    const { data } = await api.post('/media/upload', formData, {
      transformRequest: (v) => v,
    });
    preflightOk = true;
    return data;
  } catch (err) {
    if (__DEV__) {
      console.warn('[uploadMedia] failed', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
    }
    throw err;
  }
}

/**
 * One-shot pre-flight check that the upload endpoint is reachable.
 * Returns true if the endpoint responded (even with 4xx, since 401 is fine
 * here -- it means the route exists and accepts multipart). Returns false
 * if there's a transport-level failure (DNS, TLS, redirect chain, CORS).
 */
export async function uploadPreflight() {
  if (preflightOk !== null) return preflightOk;
  if (preflightInFlight) return preflightInFlight;

  preflightInFlight = (async () => {
    try {
      const formData = new FormData();
      formData.append('file', { uri: 'data:text/plain;base64,QQ==', name: 'ping.txt', type: 'text/plain' });
      await api.post('/media/upload', formData, { transformRequest: (v) => v });
      preflightOk = true;
      return true;
    } catch (err) {
      const status = err?.response?.status;
      if (status && status >= 400 && status < 500) {
        preflightOk = true;
        return true;
      }
      if (__DEV__) {
        console.warn('[uploadPreflight] endpoint unreachable', err?.message);
      }
      preflightOk = false;
      return false;
    } finally {
      preflightInFlight = null;
    }
  })();

  return preflightInFlight;
}

export function getUploadErrorMessage(err, fallback = 'Upload failed') {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback
  );
}
