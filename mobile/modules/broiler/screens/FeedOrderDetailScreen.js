import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import useLocalRecord from '@/hooks/useLocalRecord';
import FeedOrderDetail from '@/modules/broiler/details/FeedOrderDetail';
import FeedOrderSheet from '@/modules/broiler/sheets/FeedOrderSheet';

/**
 * Feed Order detail route. The new FeedOrderDetail renders its own
 * HeroSheetScreen (back button, view-invoice / edit / delete chrome,
 * brand hero, sectioned sheet, CTAs) — this screen just owns the
 * FeedOrderSheet edit wiring.
 */
export default function FeedOrderScreen() {
  const { id } = useLocalSearchParams();
  const [sheetData, setSheetData] = useState(null);

  const [order] = useLocalRecord('feedOrders', id);
  const batchId = order?.batch && typeof order.batch === 'object'
    ? order.batch._id
    : order?.batch;

  return (
    <>
      <FeedOrderDetail feedOrderId={id} onEdit={(o) => setSheetData(o)} />
      <FeedOrderSheet
        open={!!sheetData}
        onClose={() => setSheetData(null)}
        batchId={batchId}
        editData={sheetData}
      />
    </>
  );
}
