import { getDb, dbEvents } from './db';
import api from './api';

export async function uploadPendingBlob(tempId) {
  const db = await getDb();
  const blob = await db.getFirstAsync(`SELECT * FROM media_blobs WHERE _id = ?`, [tempId]);
  if (!blob) return null;

  const formData = new FormData();
  formData.append('file', {
    uri: `data:${blob.mimeType};base64,${Buffer.from(blob.blob).toString('base64')}`,
    name: blob.filename,
    type: blob.mimeType,
  });

  if (blob.metadata) {
    const meta = JSON.parse(blob.metadata);
    for (const [k, v] of Object.entries(meta)) {
      formData.append(k, v);
    }
  }

  const { data: mediaRecord } = await api.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  await db.runAsync(
    `INSERT OR REPLACE INTO id_map (tempId, entityType, realId) VALUES (?, 'media', ?)`,
    [tempId, mediaRecord._id]
  );
  await db.runAsync(`DELETE FROM media_blobs WHERE _id = ?`, [tempId]);
  dbEvents.emit('change', 'media_blobs');

  return mediaRecord;
}
