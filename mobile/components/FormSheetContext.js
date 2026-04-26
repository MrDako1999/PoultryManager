import { createContext, useContext } from 'react';

/**
 * Shared state for inputs rendered inside a `FormSheet`.
 *
 * `FormSheet` provides this context once around its body so any
 * descendant `SheetInput` can:
 *   - register itself in mount order so the sheet knows the chain of
 *     navigable fields,
 *   - ask the sheet to scroll the input into view on focus (so the
 *     keyboard never covers the active field),
 *   - report which field is currently active so the sheet's keyboard
 *     accessory toolbar (Prev / Next / Done) can update its enabled
 *     state.
 *
 * Consumers MUST treat the value as nullable — `SheetInput` is also
 * used outside of FormSheet (settings, auth, list filter bars) and
 * has to keep working with no context.
 *
 * Shape:
 *   - `register({ id, ref, multiline })` -> unregister fn
 *   - `focusNext(id)` / `focusPrev(id)` -> void
 *   - `positionForId(id)` -> `{ index, count }` over single-line fields
 *   - `scrollIntoView(wrapperRef, opts?)` -> void
 *   - `setActive(id | (cur) => id)` -> void
 */
const FormSheetContext = createContext(null);

export default FormSheetContext;

export function useFormSheetContext() {
  return useContext(FormSheetContext);
}
