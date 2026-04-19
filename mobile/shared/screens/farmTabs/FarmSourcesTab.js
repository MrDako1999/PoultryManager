import { useTranslation } from 'react-i18next';
import SourcesListView from '@/components/views/SourcesListView';

/**
 * Thin wrapper around SourcesListView, scoped to a single farm. The
 * orchestrator (FarmDetail) does the cross-batch filtering and passes the
 * already-filtered records, batch options, and filter state in as props
 * — same way BatchSourcesTab does for a single batch, just with the
 * farm-level batch picker preserved.
 */
export default function FarmSourcesTab({
  sources,
  loading,
  batchOptions,
  batchFilter,
  onBatchFilterChange,
}) {
  const { t } = useTranslation();
  return (
    <SourcesListView
      sources={sources}
      loading={loading}
      emptyTitle={t('farms.noFarmSources', 'No sources for this farm')}
      batchOptions={batchOptions}
      batchFilter={batchFilter}
      onBatchFilterChange={onBatchFilterChange}
    />
  );
}
