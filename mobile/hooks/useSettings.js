import { useState, useEffect, useCallback } from 'react';
import { getSettings, dbEvents } from '@/lib/db';

export default function useSettings(key) {
  const [value, setValue] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getSettings(key);
      setValue(result);
    } catch (err) {
      console.error(`useSettings(${key}) error:`, err);
    }
  }, [key]);

  useEffect(() => {
    refresh();
    const handler = (changedTable) => {
      if (changedTable === 'settings') refresh();
    };
    dbEvents.on('change', handler);
    return () => dbEvents.off('change', handler);
  }, [refresh]);

  return value;
}
