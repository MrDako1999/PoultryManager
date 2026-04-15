import { useParams } from 'react-router-dom';
import SourcesListView from '@/components/views/SourcesListView';
import useLocalQuery from '@/hooks/useLocalQuery';

export default function BatchSourcesView() {
  const { id, sid } = useParams();
  const sources = useLocalQuery('sources', { batch: id });

  return (
    <SourcesListView
      items={sources}
      selectedId={sid}
      basePath={`/dashboard/batches/${id}`}
      batchId={id}
      persistId={`batch-sources-${id}`}
    />
  );
}
