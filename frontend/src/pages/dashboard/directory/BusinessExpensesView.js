import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import ExpensesListView from '@/components/views/ExpensesListView';
import useLocalQuery from '@/hooks/useLocalQuery';

export default function BusinessExpensesView() {
  const { id, eid } = useParams();
  const allExpenses = useLocalQuery('expenses');

  const expenses = useMemo(
    () => allExpenses.filter((e) => {
      const tc = typeof e.tradingCompany === 'object' ? e.tradingCompany?._id : e.tradingCompany;
      return tc === id;
    }),
    [allExpenses, id],
  );

  return (
    <ExpensesListView
      items={expenses}
      selectedId={eid}
      basePath={`/dashboard/directory/businesses/${id}`}
      persistId={`biz-expenses-${id}`}
    />
  );
}
