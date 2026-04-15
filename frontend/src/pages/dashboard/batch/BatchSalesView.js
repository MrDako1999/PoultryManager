import { useParams } from 'react-router-dom';
import SalesListView from '@/components/views/SalesListView';
import useLocalQuery from '@/hooks/useLocalQuery';

export default function BatchSalesView() {
  const { id, saleId } = useParams();
  const saleOrders = useLocalQuery('saleOrders', { batch: id });

  return (
    <SalesListView
      items={saleOrders}
      selectedId={saleId}
      basePath={`/dashboard/batches/${id}`}
      batchId={id}
      persistId={`batch-sales-${id}`}
    />
  );
}
