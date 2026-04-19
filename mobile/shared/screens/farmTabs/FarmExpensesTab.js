import { useTranslation } from 'react-i18next';
import ExpensesListView from '@/components/views/ExpensesListView';

export default function FarmExpensesTab({
  expenses,
  loading,
  batchOptions,
  batchFilter,
  onBatchFilterChange,
}) {
  const { t } = useTranslation();
  return (
    <ExpensesListView
      expenses={expenses}
      loading={loading}
      emptyTitle={t('farms.noFarmExpenses', 'No expenses for this farm')}
      batchOptions={batchOptions}
      batchFilter={batchFilter}
      onBatchFilterChange={onBatchFilterChange}
    />
  );
}
