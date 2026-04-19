import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import useLocalRecord from '@/hooks/useLocalRecord';
import SourceDetail from '@/modules/broiler/details/SourceDetail';
import SourceSheet from '@/modules/broiler/sheets/SourceSheet';

/**
 * Source detail route. The new SourceDetail renders its own
 * HeroSheetScreen (back button, view-invoice / edit / delete chrome,
 * brand hero, sectioned sheet, CTAs) — this screen just owns the
 * SourceSheet edit wiring.
 */
export default function SourceScreen() {
  const { id } = useLocalSearchParams();
  const [sheetData, setSheetData] = useState(null);

  const [source] = useLocalRecord('sources', id);
  const batchId = source?.batch && typeof source.batch === 'object'
    ? source.batch._id
    : source?.batch;

  return (
    <>
      <SourceDetail sourceId={id} onEdit={(s) => setSheetData(s)} />
      <SourceSheet
        open={!!sheetData}
        onClose={() => setSheetData(null)}
        batchId={batchId}
        editData={sheetData}
      />
    </>
  );
}
