import { useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '@/lib/db';

export default function useLocalRecord(tableName, id) {
  const stableRef = useRef(null);
  const jsonRef = useRef('null');

  const record = useLiveQuery(async () => {
    if (!id || !db[tableName]) return null;
    return (await db[tableName].get(id)) ?? null;
  }, [tableName, id]);

  const value = record ?? null;
  const json = JSON.stringify(value);

  if (jsonRef.current !== json) {
    jsonRef.current = json;
    stableRef.current = value;
  }

  return stableRef.current;
}
