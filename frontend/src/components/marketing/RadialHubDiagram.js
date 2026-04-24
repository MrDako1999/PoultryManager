import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MODULE_CATALOG, MODULE_IDS } from '@poultrymanager/shared';
import { isRTL } from '@/i18n/languages';
import ModuleIconTile from './ModuleIconTile';
import { moduleColour } from './moduleVisuals';
import { selectModule } from './moduleSelection';
import { cn } from '@/lib/utils';

// Geometry, in viewBox units (0..100). Everything is derived from these so
// the SVG art and the HTML overlay nodes share one coordinate space.
//   LOGO_R       -> half of the central circle. Spoke lines start AT this
//                   radius so they appear to leave the logo edge cleanly.
//   NODE_R       -> distance from center to each module node's CENTER.
//   LINE_END_R   -> where each spoke line stops. Slightly inside NODE_R so
//                   the line tucks under the icon-tile.
//   RING_R       -> dashed orbit ring; sits just inside LINE_END_R.
//   DOT_END_R    -> how far the traveling pulse-dot flies before it fades
//                   into the node tile.
const LOGO_R = 13;
const NODE_R = 39;
const LINE_END_R = 30;
const RING_R = 31;
const DOT_END_R = 29;

function polar(cx, cy, r, angleDeg) {
  const rad = (Math.PI / 180) * angleDeg;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Display order around the radial, walked clockwise starting at the
// `RADIAL_START_ANGLE` slot. We keep this separate from the canonical
// `MODULE_IDS` (which mobile uses for activation order, settings rows, etc.)
// so re-shuffling the wheel for visual rhythm doesn't ripple into other
// product surfaces.
//
// Anchored so that BROILER lands at exactly 12 o'clock (the original
// composition the team preferred). Hatchery sits one step counter-clockwise
// (~10:30), the rest sweep clockwise from there.
//
//   slot 0  Hatchery        ~10:30
//   slot 1  Broiler         12:00  ← anchor
//   slot 2  Free-range      ~1:30
//   slot 3  Egg production  ~3:30
//   slot 4  Slaughterhouse  ~5:30
//   slot 5  Marketing       ~7:30
//   slot 6  Equipment       ~8:30
const RADIAL_DISPLAY_ORDER = [
  'hatchery',
  'broiler',
  'freeRange',
  'eggProduction',
  'slaughterhouse',
  'marketing',
  'equipment',
];

// Polar system: 0° = 3 o'clock, +90° = 6, -90° = 12. We want slot 1 (the
// anchor) to land at -90°, so slot 0 sits one step earlier.
const RADIAL_ANCHOR_SLOT = 1;
const RADIAL_ANCHOR_ANGLE = -90;
const RADIAL_START_ANGLE =
  RADIAL_ANCHOR_ANGLE - (360 / RADIAL_DISPLAY_ORDER.length) * RADIAL_ANCHOR_SLOT;

function buildNodes(rtl) {
  // Defensive: if the display order references an id that's been removed
  // from the catalog, drop it so we don't blow up. Likewise pick up any
  // catalog ids the display order forgot — they're appended after the
  // explicit list in canonical MODULE_IDS order.
  const ids = [
    ...RADIAL_DISPLAY_ORDER.filter((id) => MODULE_CATALOG[id]),
    ...MODULE_IDS.filter(
      (id) => !RADIAL_DISPLAY_ORDER.includes(id) && MODULE_CATALOG[id],
    ),
  ];
  const step = 360 / ids.length;
  return ids.map((id, i) => {
    const meta = MODULE_CATALOG[id];
    const baseAngle = RADIAL_START_ANGLE + step * i;
    // RTL: reflect across the vertical axis so the spoke pattern reads as a
    // true mirror image of LTR.
    const angle = rtl ? 180 - baseAngle : baseAngle;
    return { id, meta, angle, available: !!meta?.available };
  });
}

// `variant` lets a host context request a stripped-down version of the hub.
//   - 'full'    (default) — large radial with module name labels under each
//                node; the canonical hero-on-desktop presentation.
//   - 'compact' — smaller container, NO labels under the nodes. Used inline
//                in the mobile hero where the full diagram + labels would
//                dominate the viewport and feel out of place.
export default function RadialHubDiagram({ variant = 'full' } = {}) {
  const { t, i18n } = useTranslation();
  const rtl = isRTL(i18n.language);
  const nodes = buildNodes(rtl);
  const isCompact = variant === 'compact';

  return (
    <div
      className="w-full"
      role="img"
      aria-label={t('marketing.modulesHub.title')}
    >
      {/*
        Single radial layout for every breakpoint. The container scales from
        ~360px on a phone to 640px on desktop; geometry is in viewBox units
        so the spokes always meet the nodes at any size. The compact variant
        intentionally tops out smaller so it sits neatly between the headline
        and CTAs in the mobile hero without crowding either.
      */}
      <div
        className={
          isCompact
            // Compact still gets to breathe on tablet — capped smaller than
            // the full variant but no longer phone-tiny on a 768/900px
            // viewport where there's plenty of horizontal room.
            ? 'relative mx-auto w-full max-w-[300px] sm:max-w-[380px] md:max-w-[460px]'
            : 'relative mx-auto w-full max-w-[360px] sm:max-w-[480px] md:max-w-[640px]'
        }
      >
        <DesktopRadial nodes={nodes} t={t} showLabels={!isCompact} />
      </div>
    </div>
  );
}

// Click bursts cap and lifetime — anything beyond this just looks like
// a swarm and starts hurting paint perf. Each burst lives ~1.6s (matches
// the SVG animation duration) and is removed after that to keep state lean.
const BURST_LIFETIME_MS = 1600;
const MAX_CONCURRENT_BURSTS = 12;

function DesktopRadial({ nodes, t, showLabels = true }) {
  // hovered state lives in React because the spoke art (SVG) and the node
  // chrome (HTML overlay) need to react together when the user moves over a
  // node. Setting `hovered` to a moduleId brightens that spoke + speeds up
  // the corresponding pulse dot; setting `centerHovered` pulses the whole
  // diagram together.
  const [hovered, setHovered] = useState(null);
  const [centerHovered, setCenterHovered] = useState(false);

  // `bursts` is a list of one-shot pulse-rings fired by clicking the centre
  // logo. Each burst draws ONE extra dot per spoke that flies from the hub
  // out to the node tile and disappears. Multiple clicks stack — the more
  // you click, the more dots are mid-flight at once. We cap the queue so
  // a frustrated user mashing the button doesn't tank the framerate.
  const [bursts, setBursts] = useState([]);
  const burstSeq = useRef(0);

  function fireBurst() {
    burstSeq.current += 1;
    const id = burstSeq.current;
    setBursts((prev) => {
      const next = [...prev, { id }];
      // Drop oldest if we're over the cap. The user still sees their click
      // produce a fresh ring; they just don't see ancient ones lingering.
      return next.length > MAX_CONCURRENT_BURSTS
        ? next.slice(next.length - MAX_CONCURRENT_BURSTS)
        : next;
    });
    // Clean the burst out of state once its animation has finished so the
    // SVG doesn't accumulate stale <circle> nodes for the lifetime of the
    // page session.
    setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, BURST_LIFETIME_MS + 200);
  }

  return (
    <div className="relative w-full aspect-square">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        aria-hidden="true"
        // Pointer-events on the SVG itself stay disabled so they pass through
        // to the HTML overlay nodes — only the inline circles re-enable it
        // for their own hover.
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <radialGradient id="hub-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <circle cx={50} cy={50} r={45} fill="url(#hub-halo)" />

        {/* Dashed orbit ring */}
        <circle
          cx={50}
          cy={50}
          r={RING_R}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="0.4"
          strokeDasharray="0.8 1.4"
        />

        {/* Spoke lines + traveling pulse dots.
            Static spoke art is unified white/translucent — the rainbow of
            per-module colours felt busy and pulled the eye away from the
            central logo. The MOVING dot still carries each module's colour,
            so identity is preserved through animation while the resting
            state of the diagram reads as one cohesive system. */}
        {nodes.map((n, i) => {
          const { solid } = moduleColour(n.meta, false);
          const start = polar(50, 50, LOGO_R, n.angle);
          const end = polar(50, 50, LINE_END_R, n.angle);
          const dotEnd = polar(50, 50, DOT_END_R, n.angle);
          const length = Math.hypot(end.x - start.x, end.y - start.y);
          const isHot = hovered === n.id || centerHovered;

          // Pulse dot duration: slightly varied per spoke for an organic
          // feel; speeds up when the spoke is "hot" (hovered).
          const baseDur = 2.4 + (i % 3) * 0.3;
          const dotDur = isHot ? 1.1 : baseDur;
          const dotBegin = `${i * 0.35}s`;

          return (
            <g key={n.id}>
              {/* Spoke line — neutral white at rest, takes on the module
                  colour only when its node is being hovered (same logic as
                  the centerHovered state which lights every spoke at once). */}
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={isHot ? solid : '#ffffff'}
                strokeWidth={isHot ? 1.0 : 0.6}
                strokeLinecap="round"
                strokeOpacity={isHot ? 1 : 0.45}
                strokeDasharray={length}
                style={{
                  strokeDashoffset: length,
                  animation: `pmSpokeDraw 0.9s cubic-bezier(0.22,0.61,0.36,1) ${0.15 + i * 0.08}s forwards`,
                  transition: 'stroke 0.25s ease, stroke-width 0.25s ease, stroke-opacity 0.25s ease',
                }}
              />

              {/* Anchor dot at the spoke endpoint — keeps the module colour
                  (small, subtle) so each spoke still has a quiet hint of its
                  identity even when no animation is running. */}
              <circle
                cx={end.x}
                cy={end.y}
                r={isHot ? 1.0 : 0.7}
                fill={solid}
                fillOpacity={isHot ? 1 : 0.85}
                style={{
                  opacity: 0,
                  animation: `pmSpokeFade 0.4s ease-out ${0.45 + i * 0.08}s forwards`,
                  transition: 'r 0.25s ease, fill-opacity 0.25s ease',
                }}
              />

              {/* Traveling pulse dot — flies from the central logo edge out
                  to the spoke endpoint, fades, and repeats. This is where
                  module identity lives: each module's pulse is its colour,
                  so the diagram becomes a "circulatory system" of coloured
                  signals flowing outward from the hub. */}
              <circle r={isHot ? 1.2 : 0.95} fill={solid}>
                <animate
                  attributeName="cx"
                  values={`${start.x};${dotEnd.x}`}
                  dur={`${dotDur}s`}
                  begin={dotBegin}
                  repeatCount="indefinite"
                  keyTimes="0;1"
                />
                <animate
                  attributeName="cy"
                  values={`${start.y};${dotEnd.y}`}
                  dur={`${dotDur}s`}
                  begin={dotBegin}
                  repeatCount="indefinite"
                  keyTimes="0;1"
                />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  keyTimes="0;0.15;0.85;1"
                  dur={`${dotDur}s`}
                  begin={dotBegin}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          );
        })}

        {/* Click bursts — each entry in `bursts` adds one extra dot per
            spoke that flies once from the hub to its node tile and then
            fades out. They run on top of (not replacing) the always-on
            ambient pulses, so the radial gets visibly busier the more the
            user clicks the centre logo. Slightly bigger than the ambient
            dots and a touch faster so each click reads as its own pulse. */}
        {bursts.map((burst) => (
          <g key={`burst-${burst.id}`}>
            {nodes.map((n) => {
              const { solid } = moduleColour(n.meta, false);
              const start = polar(50, 50, LOGO_R, n.angle);
              const dotEnd = polar(50, 50, DOT_END_R, n.angle);
              return (
                <circle key={n.id} r={1.4} fill={solid}>
                  <animate
                    attributeName="cx"
                    values={`${start.x};${dotEnd.x}`}
                    dur="1.6s"
                    repeatCount="1"
                    fill="freeze"
                  />
                  <animate
                    attributeName="cy"
                    values={`${start.y};${dotEnd.y}`}
                    dur="1.6s"
                    repeatCount="1"
                    fill="freeze"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    keyTimes="0;0.08;0.85;1"
                    dur="1.6s"
                    repeatCount="1"
                    fill="freeze"
                  />
                  <animate
                    attributeName="r"
                    values="0.4;1.6;1.6;0.6"
                    keyTimes="0;0.2;0.8;1"
                    dur="1.6s"
                    repeatCount="1"
                    fill="freeze"
                  />
                </circle>
              );
            })}
          </g>
        ))}
      </svg>

      {/* Central logo — interactive:
            - hover scales it up + brightens every spoke (centerHovered)
            - click fires a one-shot burst of pulse dots; clicks stack so
              the diagram visibly responds to repeated taps */}
      <button
        type="button"
        // The button OWNS its translate(-50%,-50%) inline transform for
        // polar-coord centring. We must not let Tailwind utilities (active:
        // scale-95 etc.) overwrite that — visual press feedback lives on
        // the inner div instead, where it can compose with the existing
        // animate-hub-pulse / hover scale.
        className="absolute appearance-none border-0 bg-transparent p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-full"
        style={{
          left: '50%',
          top: '50%',
          width: `${LOGO_R * 2}%`,
          height: `${LOGO_R * 2}%`,
          transform: 'translate(-50%, -50%)',
        }}
        onMouseEnter={() => setCenterHovered(true)}
        onMouseLeave={() => setCenterHovered(false)}
        onFocus={() => setCenterHovered(true)}
        onBlur={() => setCenterHovered(false)}
        onClick={fireBurst}
        aria-label="PoultryManager — pulse spokes"
      >
        {/* Inner stack:
              - animate-hub-pulse: ambient breathing animation
              - hover: noticeable scale-up + extra emphasis from halo opacity
              - active: brief press-in to give the click tactile feedback
                without competing with the burst animation that follows */}
        <div
          className={cn(
            'relative h-full w-full animate-hub-pulse transition-transform duration-300 ease-out',
            'active:scale-95 active:duration-75',
            centerHovered && 'scale-110',
          )}
        >
          {/* Outer green-tinted halo — bigger and brand-coloured so the
              centre reads as the energy source the spokes radiate from. */}
          <span
            className={cn(
              'absolute -inset-4 rounded-full transition-opacity duration-300',
              'bg-[radial-gradient(circle,rgba(80,200,120,0.30)_0%,rgba(80,200,120,0.10)_45%,transparent_70%)]',
              'blur-md',
              centerHovered && 'opacity-100',
            )}
            aria-hidden="true"
          />
          {/* Thin colored ring just outside the white disc — mirrors the
              same coloured-ring treatment each module tile gets, anchoring
              the centre as the eighth member of the constellation. */}
          <span
            className="absolute -inset-1.5 rounded-full pointer-events-none"
            style={{
              boxShadow:
                '0 0 0 1.5px rgba(120,220,150,0.55), 0 0 18px 2px rgba(80,200,120,0.40), 0 0 36px 4px rgba(80,200,120,0.20)',
            }}
            aria-hidden="true"
          />
          <div
            className={cn(
              'relative h-full w-full rounded-full bg-white flex items-center justify-center p-3',
              'shadow-[0_10px_40px_rgba(0,0,0,0.32)]',
              'transition-shadow duration-300',
              centerHovered && 'shadow-[0_14px_56px_rgba(0,0,0,0.45)]',
            )}
          >
            <img
              src="/brand/logo.png"
              alt=""
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      </button>

      {/* HTML overlay — the seven module nodes */}
      {nodes.map((n, i) => {
        const pos = polar(50, 50, NODE_R, n.angle);
        return (
          <DesktopNode
            key={n.id}
            node={n}
            t={t}
            isHot={hovered === n.id}
            showLabel={showLabels}
            onEnter={() => setHovered(n.id)}
            onLeave={() => setHovered((cur) => (cur === n.id ? null : cur))}
            onClick={() => selectModule(n.id)}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: 'translate(-50%, -50%)',
              animationDelay: `${0.55 + i * 0.08}s`,
            }}
          />
        );
      })}
    </div>
  );
}

function DesktopNode({ node, t, style, isHot, showLabel = true, onEnter, onLeave, onClick }) {
  const { meta, id } = node;
  return (
    <div
      className={cn(
        // Width scales down on phones so the labels don't overflow the
        // ~360px container at the small end of the breakpoint range. When
        // labels are hidden (compact variant) we shrink the slot down to
        // just the icon tile so node centers don't drift — but it still
        // grows at sm/md so it stays proportional to the bigger diagram
        // on tablet-width viewports.
        showLabel
          ? 'absolute flex flex-col items-center gap-1.5 w-[88px] sm:w-[120px] md:w-[140px]'
          : 'absolute flex flex-col items-center gap-1.5 w-[44px] sm:w-[56px] md:w-[64px]',
        'opacity-0 animate-pill-rise-radial',
      )}
      style={{ ...style, animationFillMode: 'forwards' }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <button
        type="button"
        onClick={onClick}
        // The button is now just a transparent hit-area + focus ring — the
        // tile itself carries the visible chrome (circular disc + colored
        // outer halo) via chrome="glow". This dropped the redundant
        // "white square wrapping a tinted square" look the previous design
        // had and lets each module's color glow be the dominant visual.
        className={cn(
          'relative appearance-none border-0 bg-transparent p-0 cursor-pointer rounded-full',
          'transition-transform duration-300',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
          isHot && 'scale-110 -translate-y-0.5',
        )}
        aria-label={`${t(`modules.${id}`)} — ${t('marketing.modules.learnMore')}`}
      >
        <ModuleIconTile
          moduleId={id}
          meta={meta}
          size={showLabel ? 'lg' : 'lg'}
          chrome="glow"
        />
      </button>
      {showLabel && (
        <button
          type="button"
          onClick={onClick}
          className="text-center cursor-pointer focus:outline-none focus-visible:underline px-1"
          aria-label={`${t(`modules.${id}`)} — ${t('marketing.modules.learnMore')}`}
        >
          <div
            className={cn(
              // No nowrap on mobile — long labels (e.g. "Slaughterhouse",
              // "Equipment Trading") would punch out of the radial otherwise.
              // From sm: up labels fit on one line at the wider container.
              'text-[10px] sm:text-[12px] font-semibold leading-tight sm:whitespace-nowrap',
              'text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]',
              'transition-all duration-300',
              isHot && 'scale-105',
            )}
          >
            {t(`modules.${id}`)}
          </div>
        </button>
      )}
    </div>
  );
}
