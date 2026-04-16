import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { upsertEntities, getDb, dbEvents } from '@/lib/db';
import { enqueue } from '@/lib/mutationQueue';
import { processQueue } from '@/lib/syncEngine';
import useSyncStore from '@/stores/syncStore';

export default function useOfflineMutation(entityType) {
  const create = useCallback(
    async (tempId, payload, mediaFields) => {
      await upsertEntities(entityType, [{ _id: tempId, ...payload }]);
      await enqueue(entityType, 'create', tempId, payload, mediaFields);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (useSyncStore.getState().isOnline) {
        processQueue().catch(console.error);
      }
    },
    [entityType]
  );

  const update = useCallback(
    async (entityId, payload) => {
      await upsertEntities(entityType, [{ _id: entityId, ...payload }]);
      await enqueue(entityType, 'update', entityId, payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (useSyncStore.getState().isOnline) {
        processQueue().catch(console.error);
      }
    },
    [entityType]
  );

  const remove = useCallback(
    async (entityId) => {
      const db = await getDb();
      await db.runAsync(`DELETE FROM ${entityType} WHERE _id = ?`, [entityId]);
      dbEvents.emit('change', entityType);
      await enqueue(entityType, 'delete', entityId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      if (useSyncStore.getState().isOnline) {
        processQueue().catch(console.error);
      }
    },
    [entityType]
  );

  return { create, update, remove };
}
