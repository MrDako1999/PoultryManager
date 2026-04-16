import { useMemo } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import OperationsListView from '@/modules/broiler/views/OperationsListView';
import useLocalQuery from '@/hooks/useLocalQuery';

export default function BatchHouseOpsView() {
  const { id, houseId, logId } = useParams();
  const { batch } = useOutletContext();
  const { t } = useTranslation();

  const allLogs = useLocalQuery('dailyLogs', { batch: id });
  const houseLogs = useMemo(
    () => allLogs.filter((log) => {
      const lid = typeof log.house === 'object' ? log.house._id : log.house;
      return lid === houseId;
    }),
    [allLogs, houseId],
  );

  const houseEntry = (batch?.houses || []).find((e) => {
    const hId = typeof e.house === 'object' ? e.house._id : e.house;
    return hId === houseId;
  });
  const houseName = houseEntry
    ? (typeof houseEntry.house === 'object' ? houseEntry.house.name : null) || `${t('batches.house')} ${houseId}`
    : `${t('batches.house')} ${houseId}`;

  return (
    <OperationsListView
      items={houseLogs}
      selectedId={logId}
      basePath={`/dashboard/batches/${id}/performance/${houseId}`}
      batchId={id}
      houseId={houseId}
      houseName={houseName}
      batch={batch}
      persistId={`batch-ops-${id}-${houseId}`}
    />
  );
}
