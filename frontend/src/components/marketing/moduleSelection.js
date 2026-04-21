// Tiny event bus that lets the radial hub diagram (inside the hero) ask the
// module showcase section (further down the page) to scroll into view and
// open its detail dialog. Avoids prop-drilling through LandingPage ->
// LandingHero -> RadialHubDiagram for what is essentially a one-shot signal.
//
// Implementation: a CustomEvent on the window object. The showcase listens
// for it on mount, the diagram (and any future caller) just dispatches.

const EVENT_NAME = 'pm:module-select';

export function selectModule(moduleId) {
  if (typeof window === 'undefined' || !moduleId) return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { moduleId } }));
}

export function onModuleSelect(handler) {
  if (typeof window === 'undefined') return () => {};
  const listener = (e) => handler(e.detail?.moduleId);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
