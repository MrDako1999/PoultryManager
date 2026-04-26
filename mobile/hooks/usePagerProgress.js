import PagerView from 'react-native-pager-view';
import Animated, {
  useSharedValue,
  useEvent,
  useHandler,
} from 'react-native-reanimated';

/**
 * usePagerProgress — UI-thread scroll tracker for `react-native-pager-view`.
 *
 * Why this exists:
 *
 * The naive pattern is to drive an `Animated.Value` from a JS `onPageScroll`
 * handler (`pagerProgress.setValue(position + offset)`), then feed that value
 * into every `interpolate()` in the tab strip. Every pager frame has to
 * bridge native → JS, recompute every interpolation on the JS thread, and
 * bridge the style changes back to native. On Android, under any JS load
 * (list render, initial data fetch, Lottie, map tiles), that loop collapses
 * to single-digit FPS and swiping looks frozen — which is exactly the "2 fps"
 * regression users are hitting on the batch detail screen.
 *
 * By returning a reanimated `SharedValue` plus a worklet `scrollHandler`, the
 * progress tracking runs entirely on the UI thread. The bridge is out of the
 * hot path, so the indicator and label fades stay at 60+ FPS regardless of
 * what the JS thread is doing.
 *
 * Usage:
 *   const { progress, scrollHandler } = usePagerProgress(initialPage);
 *   // ...
 *   <AnimatedPagerView onPageScroll={scrollHandler} initialPage={initialPage}>
 *   <Tabs progress={progress} ... />
 */

// PagerView must be wrapped with reanimated's `createAnimatedComponent` so the
// event handler returned by `useEvent` can be attached as a worklet-backed
// `onPageScroll` prop. A plain `PagerView` would route the event through JS.
export const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

// Reanimated's `useEvent` is general-purpose — pager-view doesn't ship its
// own integration, so we hand-wire the `onPageScroll` event name here using
// the documented `useHandler` + `useEvent` pattern.
function usePagerScrollHandler(handlers, dependencies) {
  const { context, doDependenciesDiffer } = useHandler(handlers, dependencies);
  return useEvent(
    (event) => {
      'worklet';
      const { onPageScroll } = handlers;
      if (onPageScroll && event.eventName.endsWith('onPageScroll')) {
        onPageScroll(event, context);
      }
    },
    ['onPageScroll'],
    doDependenciesDiffer
  );
}

export default function usePagerProgress(initialPage = 0) {
  const progress = useSharedValue(initialPage);

  const scrollHandler = usePagerScrollHandler(
    {
      onPageScroll: (e) => {
        'worklet';
        progress.value = e.position + e.offset;
      },
    },
    []
  );

  return { progress, scrollHandler };
}
