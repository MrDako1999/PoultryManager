import { useState, useEffect, useCallback, useMemo } from 'react';

export default function useGroupExpand(groupKeys, storageKey) {
  const [openState, setOpenState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); }
    catch { return {}; }
  });

  useEffect(() => {
    if (Object.keys(openState).length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(openState));
    }
  }, [openState, storageKey]);

  const toggle = useCallback(
    (key) => setOpenState((prev) => ({ ...prev, [key]: !(prev[key] ?? true) })),
    [],
  );

  const allExpanded = useMemo(
    () => groupKeys.every((k) => openState[k] ?? true),
    [groupKeys, openState],
  );

  const toggleAll = useCallback(() => {
    setOpenState((prev) => {
      const allOpen = groupKeys.every((k) => prev[k] ?? true);
      const next = {};
      groupKeys.forEach((k) => { next[k] = !allOpen; });
      return next;
    });
  }, [groupKeys]);

  const isOpen = useCallback(
    (key) => openState[key] ?? true,
    [openState],
  );

  return { isOpen, toggle, toggleAll, allExpanded };
}
