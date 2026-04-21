import { useTranslation } from 'react-i18next';
import { FaApple, FaGooglePlay } from 'react-icons/fa';
import SectionShell from './SectionShell';

// Two side-by-side store badges, both rendered as "coming soon" until the
// production iOS + Android builds clear review. Real download links can be
// dropped in later by swapping `live: true` and adding an `href` here.
//
// Icons use the brand-accurate marks via react-icons:
//   FaApple       — official Apple silhouette logo
//   FaGooglePlay  — official Google Play triangle play mark
// Lucide's `Apple` is a stylized fruit (with leaf) and lucide doesn't ship
// a Google Play glyph at all, so react-icons (already a dep) is the right
// source here.
const STORES = [
  {
    id: 'ios',
    Icon: FaApple,
    taglineKey: 'marketing.mobileApps.iosTagline',
    storeKey: 'marketing.mobileApps.iosStore',
    soonKey: 'marketing.mobileApps.comingSoonIos',
    live: false,
    href: null,
  },
  {
    id: 'android',
    Icon: FaGooglePlay,
    taglineKey: 'marketing.mobileApps.androidTagline',
    storeKey: 'marketing.mobileApps.androidStore',
    soonKey: 'marketing.mobileApps.comingSoonAndroid',
    live: false,
    href: null,
  },
];

export default function MobileAppsBlock() {
  const { t } = useTranslation();

  return (
    <SectionShell
      id="mobile-apps"
      eyebrow={t('marketing.mobileApps.eyebrow')}
      title={t('marketing.mobileApps.title')}
      subtitle={t('marketing.mobileApps.body')}
      tone="tinted"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {STORES.map((store) => (
          <StoreBadge
            key={store.id}
            Icon={store.Icon}
            tagline={t(store.taglineKey)}
            store={t(store.storeKey)}
            soon={t(store.soonKey)}
            live={store.live}
            href={store.href}
          />
        ))}
      </div>
    </SectionShell>
  );
}

function StoreBadge({ Icon, tagline, store, soon, live, href }) {
  // The card is identical for both states; only the dashed border, opacity,
  // and "coming soon" caption flip on the live -> coming-soon axis. When a
  // store goes live we set `live: true` + `href` and drop the disabled chrome.
  const Tag = live && href ? 'a' : 'div';
  const tagProps = live && href
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : { 'aria-disabled': 'true' };

  return (
    <Tag
      {...tagProps}
      className={[
        'flex items-center gap-3 rounded-2xl px-5 py-4',
        live
          ? 'bg-foreground text-background hover:opacity-90 transition-opacity'
          : 'border-2 border-dashed border-sectionBorder bg-card text-foreground/70',
      ].join(' ')}
    >
      {/* react-icons fa* glyphs are filled SVG paths, not strokes — no
          strokeWidth needed. h-8 w-8 reads at the right weight against the
          two-line "Download on the / App Store" text block. */}
      <Icon className="h-8 w-8 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-start">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] opacity-70">
          {tagline}
        </div>
        <div className="text-base font-semibold leading-tight">{store}</div>
        {!live && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">{soon}</div>
        )}
      </div>
    </Tag>
  );
}
