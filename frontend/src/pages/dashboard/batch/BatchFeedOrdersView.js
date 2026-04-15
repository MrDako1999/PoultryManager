import { useParams } from 'react-router-dom';
import FeedOrdersListView from '@/components/views/FeedOrdersListView';
import useLocalQuery from '@/hooks/useLocalQuery';

export default function BatchFeedOrdersView() {
  const { id, fid } = useParams();
  const feedOrders = useLocalQuery('feedOrders', { batch: id });

  return (
    <FeedOrdersListView
      items={feedOrders}
      selectedId={fid}
      basePath={`/dashboard/batches/${id}`}
      batchId={id}
      persistId={`batch-feed-orders-${id}`}
    />
  );
}
