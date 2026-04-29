import { useState, useEffect, useCallback, useRef } from 'react';
import { getAllEntities, dbEvents, SOFT_DELETE_TABLES } from '@/lib/db';
import { recordError } from '@/lib/errorBuffer';

export default function useLocalQuery(tableName, filters) {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const refresh = useCallback(async () => {
    try {
      let result = await getAllEntities(tableName);
      const f = filtersRef.current;

      if (SOFT_DELETE_TABLES.includes(tableName)) {
        result = result.filter((r) => !r.deletedAt);
      }

      if (f && typeof f === 'object') {
        result = result.filter((item) =>
          Object.entries(f).every(([key, val]) => {
            const itemVal = item[key];
            if (itemVal && typeof itemVal === 'object' && itemVal._id) {
              return itemVal._id === val;
            }
            return itemVal === val;
          })
        );
      }

      setData(result);
    } catch (err) {
      // Without this `recordError` the failure is invisible to the
      // user and to us — the catch has been silently leaving stale
      // `data` in place, which is exactly what masked the EMUI
      // broken-handle bug for so long. Tag the entry with the table
      // name so the diagnostic can pinpoint which screen tripped.
      console.error(`useLocalQuery(${tableName}) error:`, err);
      recordError('useLocalQuery', err, undefined, { table: tableName });
    } finally {
      setIsLoading(false);
    }
  }, [tableName]);

  useEffect(() => {
    refresh();
    const handler = (changedTable) => {
      if (changedTable === tableName) refresh();
    };
    dbEvents.on('change', handler);
    return () => dbEvents.off('change', handler);
  }, [tableName, refresh]);

  return [data, isLoading];
}
