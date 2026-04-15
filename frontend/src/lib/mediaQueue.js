import db from './db';
import api from './api';

export async function storeBlob(file) {
  const buffer = await file.arrayBuffer();
  const tempId = crypto.randomUUID();

  const record = {
    _id: tempId,
    blob: buffer,
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    metadata: {},
  };

  await db.mediaBlobs.put(record);

  const blobUrl = URL.createObjectURL(new Blob([buffer], { type: file.type }));

  return {
    _id: tempId,
    url: blobUrl,
    original_filename: file.name,
    mime_type: file.type,
    file_size: file.size,
    _isLocal: true,
  };
}

export function isLocalId(id) {
  return typeof id === 'string' && !/^[0-9a-fA-F]{24}$/.test(id);
}

export async function deleteLocalBlob(tempId) {
  await db.mediaBlobs.delete(tempId);
}

export async function uploadPendingBlob(tempId) {
  const record = await db.mediaBlobs.get(tempId);
  if (!record) return null;

  const formData = new FormData();
  const file = new File([record.blob], record.filename, { type: record.mimeType });
  formData.append('file', file);

  if (record.metadata) {
    for (const [k, v] of Object.entries(record.metadata)) {
      formData.append(k, v);
    }
  }

  const { data: mediaRecord } = await api.post('/media/upload', formData);

  await db.idMap.put({ tempId, entityType: 'media', realId: mediaRecord._id });
  await db.mediaBlobs.delete(tempId);

  return mediaRecord;
}

export function createObjectURL(tempId) {
  return db.mediaBlobs.get(tempId).then(record => {
    if (!record) return null;
    return URL.createObjectURL(new Blob([record.blob], { type: record.mimeType }));
  });
}

export async function cleanup() {
  const synced = await db.mutationQueue.where('status').equals('synced').toArray();
  const syncedMediaIds = new Set();

  for (const entry of synced) {
    if (entry.mediaFields && entry.payload) {
      for (const field of entry.mediaFields) {
        const val = entry.payload[field];
        if (Array.isArray(val)) val.forEach(id => syncedMediaIds.add(id));
        else if (val) syncedMediaIds.add(val);
      }
    }
  }

  for (const id of syncedMediaIds) {
    await db.mediaBlobs.delete(id);
  }

  const syncedIds = synced.map(e => e.id);
  if (syncedIds.length > 0) {
    await db.mutationQueue.bulkDelete(syncedIds);
  }
}
