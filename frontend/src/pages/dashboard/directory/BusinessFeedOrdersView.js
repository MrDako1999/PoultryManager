import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import FeedOrdersListView from '@/components/views/FeedOrdersListView';
import useLocalQuery from '@/hooks/useLocalQuery';

export default function BusinessFeedOrdersView() {
  const { id, fid } = useParams();
  const allFeedOrders = useLocalQuery('feedOrders');

  const feedOrders = useMemo(
    () => allFeedOrders.filter((f) => {
      const fc = typeof f.feedCompany === 'object' ? f.feedCompany?._id : f.feedCompany;
      return fc === id;
    }),
    [allFeedOrders, id],
  );

  return (
    <FeedOrdersListView
      items={feedOrders}
      selectedId={fid}
      basePath={`/dashboard/directory/businesses/${id}`}
      persistId={`biz-feed-orders-${id}`}
    />
  );
}
