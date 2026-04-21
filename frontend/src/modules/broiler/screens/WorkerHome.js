import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, ClipboardList, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import useAuthStore from '@/stores/authStore';
import useLocalQuery from '@/hooks/useLocalQuery';

function isSameLocalDay(a, b) {
  if (!a || !b) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export default function WorkerHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const workers = useLocalQuery('workers');
  const houses = useLocalQuery('houses');
  const batches = useLocalQuery('batches');
  const dailyLogs = useLocalQuery('dailyLogs');

  const worker = useMemo(
    () => workers.find((w) => {
      const linkedId = typeof w.linkedUser === 'object' ? w.linkedUser?._id : w.linkedUser;
      return String(linkedId) === String(user?._id);
    }),
    [workers, user?._id],
  );

  // Derive accessible houses from farmAssignments (primary) and union
  // with any legacy explicit houseAssignments. Mirrors the backend
  // helper getAssignedHouseIds in backend/services/workerScope.js so
  // the worker dashboard never shows houses they can't actually log.
  const assignedHouseIds = useMemo(() => {
    const farmIds = Array.isArray(worker?.farmAssignments)
      ? worker.farmAssignments.map((f) => String(typeof f === 'object' ? f._id : f))
      : [];
    const legacyHouseIds = Array.isArray(worker?.houseAssignments)
      ? worker.houseAssignments.map((h) => String(typeof h === 'object' ? h._id : h))
      : [];
    const farmHouseIds = farmIds.length
      ? houses
          .filter((h) => {
            const fid = String(typeof h.farm === 'object' ? h.farm?._id : h.farm || '');
            return farmIds.includes(fid);
          })
          .map((h) => String(h._id))
      : [];
    return [...new Set([...legacyHouseIds, ...farmHouseIds])];
  }, [worker, houses]);

  const myHouses = useMemo(() => {
    if (assignedHouseIds.length === 0) return [];
    return houses.filter((h) => assignedHouseIds.includes(String(h._id)));
  }, [houses, assignedHouseIds]);

  const activeBatchByHouse = useMemo(() => {
    const m = new Map();
    for (const batch of batches) {
      if (batch.status === 'COMPLETE') continue;
      for (const entry of batch.houses || []) {
        const hid = typeof entry.house === 'object' ? entry.house?._id : entry.house;
        if (hid) m.set(String(hid), batch);
      }
    }
    return m;
  }, [batches]);

  const todaySubmittedByHouse = useMemo(() => {
    const now = new Date();
    const set = new Set();
    for (const log of dailyLogs) {
      if (log.logType !== 'DAILY') continue;
      const authorId = typeof log.createdBy === 'object' ? log.createdBy?._id : log.createdBy;
      if (String(authorId) !== String(user?._id)) continue;
      const hid = typeof log.house === 'object' ? log.house?._id : log.house;
      if (isSameLocalDay(log.date, now)) set.add(String(hid));
    }
    return set;
  }, [dailyLogs, user?._id]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">
          {t('dashboard.welcome', { name: user?.firstName || '' })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('worker.assignedHousesSubtitle', 'Your assigned houses')}
        </p>
      </div>

      {myHouses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4 inline-flex">
              <Home className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {t('worker.noAssignmentsTitle', 'No houses assigned')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t('worker.noAssignmentsDesc',
                'Ask your supervisor to assign you to one or more houses to start recording daily logs.')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {myHouses.map((house) => {
            const batch = activeBatchByHouse.get(String(house._id));
            const submitted = todaySubmittedByHouse.has(String(house._id));
            const bgClass = submitted
              ? 'border-green-500/30 bg-green-500/5'
              : 'hover:bg-accent/50';

            return (
              <Card
                key={house._id}
                className={`cursor-pointer transition-colors ${bgClass}`}
                onClick={() => {
                  if (batch?._id) navigate(`/dashboard/batches/${batch._id}`);
                }}
              >
                <CardContent className="pt-5 pb-4 flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Home className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-foreground">{house.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {batch ? batch.batchName : t('worker.noActiveBatch', 'No active batch')}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <ClipboardList className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {submitted
                          ? t('worker.submittedToday', 'Daily log submitted')
                          : t('worker.dailyLogPending', 'Daily log pending')}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
