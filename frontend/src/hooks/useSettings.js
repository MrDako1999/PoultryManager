import { useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '@/lib/db';

export default function useSettings(key) {
  const stableRef = useRef(null);
  const jsonRef = useRef('null');

  const setting = useLiveQuery(async () => {
    const row = await db.settings.get(key);
    return row?.value ?? null;
  }, [key]);

  const value = setting ?? null;
  const json = JSON.stringify(value);

  if (jsonRef.current !== json) {
    jsonRef.current = json;
    stableRef.current = value;
  }

  return stableRef.current;
}
