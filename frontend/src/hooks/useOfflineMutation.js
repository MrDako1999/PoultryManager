import { useCallback, useState } from 'react';
import db from '@/lib/db';
import { enqueue } from '@/lib/mutationQueue';
import { processQueue } from '@/lib/syncEngine';
import useSyncStore from '@/stores/syncStore';

export default function useOfflineMutation(entityType) {
  const [isPending, setIsPending] = useState(false);

  const mutate = useCallback(async ({ action, id, data, mediaFields }, options = {}) => {
    setIsPending(true);
    try {
      if (action === 'create') {
        const tempId = crypto.randomUUID();
        const record = { _id: tempId, ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await db[entityType].put(record);
        await enqueue(entityType, 'create', tempId, data, mediaFields);
        options.onSuccess?.(record);
      } else if (action === 'update') {
        const existing = await db[entityType].get(id);
        if (existing) {
          const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
          await db[entityType].put(updated);
        }
        await enqueue(entityType, 'update', id, data, mediaFields);
        options.onSuccess?.();
      } else if (action === 'delete') {
        await db[entityType].delete(id);
        await enqueue(entityType, 'delete', id, null);
        options.onSuccess?.();
      }

      const store = useSyncStore.getState();
      if (store.isOnline) {
        processQueue().catch(() => {});
      }
    } catch (err) {
      options.onError?.(err);
    } finally {
      setIsPending(false);
    }
  }, [entityType]);

  return { mutate, isPending };
}
