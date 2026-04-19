import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import useLocalRecord from '@/hooks/useLocalRecord';
import SaleDetail from '@/modules/broiler/details/SaleDetail';
import SaleOrderSheet from '@/modules/broiler/sheets/SaleOrderSheet';

/**
 * Sale detail route. The new SaleDetail renders its own HeroSheetScreen
 * (back button, edit / delete chrome, brand hero, sectioned sheet, CTAs)
 * — this screen just owns the SaleOrderSheet edit wiring.
 */
export default function SaleScreen() {
  const { id } = useLocalSearchParams();
  const [sheetData, setSheetData] = useState(null);

  const [sale] = useLocalRecord('saleOrders', id);
  const batchId = sale?.batch && typeof sale.batch === 'object'
    ? sale.batch._id
    : sale?.batch;

  return (
    <>
      <SaleDetail saleId={id} onEdit={(s) => setSheetData(s)} />
      <SaleOrderSheet
        open={!!sheetData}
        onClose={() => setSheetData(null)}
        batchId={batchId}
        editData={sheetData}
      />
    </>
  );
}
