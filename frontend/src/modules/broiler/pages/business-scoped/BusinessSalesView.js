import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import SalesListView from '@/modules/broiler/views/SalesListView';
import useLocalQuery from '@/hooks/useLocalQuery';

export default function BusinessSalesView() {
  const { id, saleId } = useParams();
  const allSaleOrders = useLocalQuery('saleOrders');

  const saleOrders = useMemo(
    () => allSaleOrders.filter((s) => {
      const c = typeof s.customer === 'object' ? s.customer?._id : s.customer;
      return c === id;
    }),
    [allSaleOrders, id],
  );

  return (
    <SalesListView
      items={saleOrders}
      selectedId={saleId}
      basePath={`/dashboard/directory/businesses/${id}`}
      persistId={`biz-sales-${id}`}
    />
  );
}
