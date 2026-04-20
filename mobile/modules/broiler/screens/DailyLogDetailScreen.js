import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import useLocalRecord from '@/hooks/useLocalRecord';
import DailyLogDetail from '@/modules/broiler/details/DailyLogDetail';
import DailyLogSheet from '@/modules/broiler/sheets/DailyLogSheet';

/**
 * Daily-log detail route. DailyLogDetail uses DetailCompactScreen (compact
 * gradient bar, sectioned scroll body, CTAs) — this screen owns DailyLogSheet
 * edit wiring.
 */
export default function DailyLogScreen() {
  const { id } = useLocalSearchParams();
  const [sheetData, setSheetData] = useState(null);

  const [log] = useLocalRecord('dailyLogs', id);
  const batchId = log?.batch && typeof log.batch === 'object'
    ? log.batch._id
    : log?.batch;

  // Hydrate the parent batch so the edit sheet can re-render the house
  // picker. The legacy wrapper passed `houses={[]}` here and silently
  // hid the picker — fixed in the same pass as the visual refresh.
  const [batch] = useLocalRecord('batches', batchId);

  return (
    <>
      <DailyLogDetail logId={id} onEdit={(l) => setSheetData(l)} />
      <DailyLogSheet
        open={!!sheetData}
        onClose={() => setSheetData(null)}
        batchId={batchId}
        houses={batch?.houses || []}
        editData={sheetData}
      />
    </>
  );
}
