import { useCallback, useMemo, useRef, useState } from 'react';

/**
 * Generic stepper for stage-by-stage forms. Holds an ordered list of step
 * descriptors and a notion of which steps are currently "available" (gated
 * behind upstream completion). Exposes prev / next / focus helpers that the
 * keyboard toolbar and onSubmitEditing handlers can call.
 *
 * Step shape:
 *   { key: string, available: boolean, onActivate: () => void }
 *
 * `onActivate` is what runs when this step becomes current - typically
 * `inputRef.current?.focus()` for text inputs or `pickerRef.current?.open()`
 * for pickers / selects / date sheets. For "tile" stages (no focusable
 * element), `onActivate` should at least scroll the stage into view.
 */
export default function useFormStepper(steps) {
  const [currentKey, setCurrentKey] = useState(null);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const availableSteps = useMemo(
    () => steps.filter((s) => s.available),
    [steps]
  );

  const indexOf = useCallback((key) => {
    return availableSteps.findIndex((s) => s.key === key);
  }, [availableSteps]);

  const activate = useCallback((key) => {
    const step = stepsRef.current.find((s) => s.key === key);
    if (!step) return;
    setCurrentKey(key);
    requestAnimationFrame(() => step.onActivate?.());
  }, []);

  const goToOffset = useCallback((delta) => {
    const list = availableSteps;
    if (list.length === 0) return;
    const fromIdx = currentKey ? indexOf(currentKey) : -1;
    let nextIdx = fromIdx + delta;
    if (nextIdx < 0) nextIdx = 0;
    if (nextIdx > list.length - 1) nextIdx = list.length - 1;
    const next = list[nextIdx];
    if (!next) return;
    activate(next.key);
  }, [availableSteps, currentKey, indexOf, activate]);

  const next = useCallback(() => goToOffset(1), [goToOffset]);
  const prev = useCallback(() => goToOffset(-1), [goToOffset]);

  const canGoNext = useMemo(() => {
    if (!availableSteps.length) return false;
    if (!currentKey) return true;
    return indexOf(currentKey) < availableSteps.length - 1;
  }, [availableSteps, currentKey, indexOf]);

  const canGoPrev = useMemo(() => {
    if (!currentKey) return false;
    return indexOf(currentKey) > 0;
  }, [currentKey, indexOf]);

  return { currentKey, setCurrentKey, activate, next, prev, canGoNext, canGoPrev };
}
