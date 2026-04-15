import { useParams } from 'react-router-dom';
import ExpensesListView from '@/components/views/ExpensesListView';
import useLocalQuery from '@/hooks/useLocalQuery';

export default function BatchExpensesView() {
  const { id, eid } = useParams();
  const expenses = useLocalQuery('expenses', { batch: id });

  return (
    <ExpensesListView
      items={expenses}
      selectedId={eid}
      basePath={`/dashboard/batches/${id}`}
      batchId={id}
      persistId={`batch-expenses-${id}`}
    />
  );
}
