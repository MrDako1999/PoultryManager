import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import useLocalRecord from '@/hooks/useLocalRecord';
import ExpenseDetail from '@/modules/broiler/details/ExpenseDetail';
import ExpenseSheet from '@/modules/broiler/sheets/ExpenseSheet';

/**
 * Expense detail route. ExpenseDetail uses DetailCompactScreen (compact
 * gradient bar, sectioned scroll body, CTAs) — this screen owns ExpenseSheet
 * edit wiring.
 */
export default function ExpenseScreen() {
  const { id } = useLocalSearchParams();
  const [sheetData, setSheetData] = useState(null);

  const [expense] = useLocalRecord('expenses', id);
  const batchId = expense?.batch && typeof expense.batch === 'object'
    ? expense.batch._id
    : expense?.batch;

  return (
    <>
      <ExpenseDetail expenseId={id} onEdit={(e) => setSheetData(e)} />
      <ExpenseSheet
        open={!!sheetData}
        onClose={() => setSheetData(null)}
        batchId={batchId}
        editData={sheetData}
      />
    </>
  );
}
