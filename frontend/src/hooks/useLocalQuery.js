import { useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { SOFT_DELETE_TABLES } from '@/lib/db';

function fingerprint(arr) {
  if (!arr || arr.length === 0) return '0:';
  let fp = `${arr.length}:`;
  for (let i = 0; i < arr.length; i++) {
    fp += arr[i]._id || i;
    if (arr[i].updatedAt) fp += arr[i].updatedAt;
    fp += ',';
  }
  return fp;
}

export default function useLocalQuery(tableName, filter) {
  const stableRef = useRef([]);
  const fpRef = useRef('0:');

  const data = useLiveQuery(async () => {
    const table = db[tableName];
    if (!table) return [];

    let collection;
    if (filter && typeof filter === 'object' && Object.keys(filter).length > 0) {
      const keys = Object.keys(filter);
      collection = table.where(keys[0]).equals(filter[keys[0]]);

      for (let i = 1; i < keys.length; i++) {
        const records = await collection.toArray();
        return records.filter(r => {
          for (let j = i; j < keys.length; j++) {
            if (r[keys[j]] !== filter[keys[j]]) return false;
          }
          if (SOFT_DELETE_TABLES.includes(tableName)) {
            return !r.deletedAt;
          }
          return true;
        });
      }
    } else {
      collection = table.toCollection();
    }

    let results = await collection.toArray();

    if (SOFT_DELETE_TABLES.includes(tableName)) {
      results = results.filter(r => !r.deletedAt);
    }

    return results;
  }, [tableName, JSON.stringify(filter)]);

  const value = data ?? [];
  const fp = fingerprint(value);

  if (fpRef.current !== fp) {
    fpRef.current = fp;
    stableRef.current = value;
  }

  return stableRef.current;
}
