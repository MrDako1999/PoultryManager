import { useTranslation } from 'react-i18next';
import FeedOrdersListView from '@/components/views/FeedOrdersListView';

export default function FarmFeedOrdersTab({
  feedOrders,
  loading,
  batchOptions,
  batchFilter,
  onBatchFilterChange,
}) {
  const { t } = useTranslation();
  return (
    <FeedOrdersListView
      feedOrders={feedOrders}
      loading={loading}
      emptyTitle={t('farms.noFarmFeedOrders', 'No feed orders for this farm')}
      batchOptions={batchOptions}
      batchFilter={batchFilter}
      onBatchFilterChange={onBatchFilterChange}
    />
  );
}
