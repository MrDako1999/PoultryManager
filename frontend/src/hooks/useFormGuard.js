import { useState, useRef, useCallback } from 'react';

export default function useFormGuard(formIsDirty) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [extraDirty, setExtraDirty] = useState(false);
  const readyRef = useRef(false);

  const isDirty = formIsDirty || extraDirty;

  const markDirty = useCallback(() => {
    if (readyRef.current) setExtraDirty(true);
  }, []);

  const resetGuard = useCallback(() => {
    setExtraDirty(false);
    readyRef.current = false;
    setConfirmOpen(false);
  }, []);

  const armGuard = useCallback(() => {
    readyRef.current = true;
  }, []);

  return {
    confirmOpen,
    setConfirmOpen,
    isDirty,
    markDirty,
    resetGuard,
    armGuard,
  };
}
