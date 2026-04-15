import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import SourcesListView from '@/components/views/SourcesListView';
import useLocalQuery from '@/hooks/useLocalQuery';

export default function BusinessSourcesView() {
  const { id, sid } = useParams();
  const allSources = useLocalQuery('sources');

  const sources = useMemo(
    () => allSources.filter((s) => {
      const sf = typeof s.sourceFrom === 'object' ? s.sourceFrom?._id : s.sourceFrom;
      return sf === id;
    }),
    [allSources, id],
  );

  return (
    <SourcesListView
      items={sources}
      selectedId={sid}
      basePath={`/dashboard/directory/businesses/${id}`}
      persistId={`biz-sources-${id}`}
    />
  );
}
