import { useTranslation } from 'react-i18next';
import SalesListView from '@/components/views/SalesListView';

export default function FarmSalesTab({
  sales,
  loading,
  batchOptions,
  batchFilter,
  onBatchFilterChange,
}) {
  const { t } = useTranslation();
  return (
    <SalesListView
      sales={sales}
      loading={loading}
      emptyTitle={t('farms.noFarmSales', 'No sales for this farm')}
      batchOptions={batchOptions}
      batchFilter={batchFilter}
      onBatchFilterChange={onBatchFilterChange}
    />
  );
}
