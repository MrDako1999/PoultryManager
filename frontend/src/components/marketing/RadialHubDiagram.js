import { useState } from 'react';
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

function buildNodes(rtl) {
  const step = 360 / MODULE_IDS.length;
  return MODULE_IDS.map((id, i) => {
    const meta = MODULE_CATALOG[id];
    const baseAngle = -90 + step * i;
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

function DesktopRadial({ nodes, t, showLabels = true }) {
  // hovered state lives in React because the spoke art (SVG) and the node
  // chrome (HTML overlay) need to react together when the user moves over a
  // node. Setting `hovered` to a moduleId brightens that spoke + speeds up
  // the corresponding pulse dot; setting `centerHovered` pulses the whole
  // diagram together.
  const [hovered, setHovered] = useState(null);
  const [centerHovered, setCenterHovered] = useState(false);

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
      </svg>

      {/* Central logo — interactive: hover scales it up + brightens every
          spoke at once via the centerHovered state. */}
      <button
        type="button"
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
        aria-label="PoultryManager"
      >
        <div
          className={cn(
            'relative h-full w-full animate-hub-pulse transition-transform duration-300',
            centerHovered && 'scale-105',
          )}
        >
          <span
            className={cn(
              'absolute -inset-2 rounded-full bg-white/10 blur-xl transition-opacity duration-300',
              centerHovered && 'opacity-100 bg-white/20',
            )}
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
        className={cn(
          'relative appearance-none border-0 cursor-pointer rounded-2xl bg-white',
          showLabel ? 'p-2 sm:p-2.5' : 'p-1.5 sm:p-2 md:p-2.5',
          'shadow-[0_8px_28px_rgba(0,0,0,0.22)] ring-1 ring-black/5',
          'transition-all duration-300',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
          isHot && 'scale-110 ring-2 ring-primary/40 shadow-[0_14px_44px_rgba(0,0,0,0.36)] -translate-y-0.5',
        )}
        aria-label={`${t(`modules.${id}`)} — ${t('marketing.modules.learnMore')}`}
      >
        <ModuleIconTile moduleId={id} meta={meta} size="md" />
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
