import { useState, useEffect, useCallback } from 'react';
import { getEntityById, dbEvents } from '../lib/db';

export default function useLocalRecord(tableName, id) {
  const [record, setRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) { setRecord(null); setIsLoading(false); return; }
    try {
      const result = await getEntityById(tableName, id);
      setRecord(result);
    } catch (err) {
      console.error(`useLocalRecord(${tableName}, ${id}) error:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [tableName, id]);

  useEffect(() => {
    setIsLoading(true);
    refresh();
    const handler = (changedTable) => {
      if (changedTable === tableName) refresh();
    };
    dbEvents.on('change', handler);
    return () => dbEvents.off('change', handler);
  }, [tableName, refresh]);

  return [record, isLoading];
}
