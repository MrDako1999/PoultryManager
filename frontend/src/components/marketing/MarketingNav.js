import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, LayoutDashboard } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';
import useThemeStore from '@/stores/themeStore';
import useAuthStore from '@/stores/authStore';
import { cn } from '@/lib/utils';

// Two banner variants of the PoultryManager wordmark live under
// /public/media/logo/. The white variant is for any dark backdrop (the green
// hero gradient OR the dark-mode page background). The dark variant is for
// the light-mode page background only.
const BANNER_DARK = '/media/logo/PM_Banner.png';        // dark text on transparent
const BANNER_WHITE = '/media/logo/PM_banner_white.png'; // white text on transparent

// Sticky top nav shared by every marketing page. Translucent over the gradient
// hero (transparent on landing at the top), gains a soft blur + border once the
// page scrolls past the hero. Anchor links (Features / Modules / How / Pricing
// / FAQ) only target sections on the landing page; on the legal/contact pages
// they navigate the user back home and then scroll.
const NAV_ANCHORS = [
  { id: 'modules', labelKey: 'marketing.nav.modules' },
  { id: 'how-it-works', labelKey: 'marketing.nav.howItWorks' },
  { id: 'pricing', labelKey: 'marketing.nav.pricing' },
  { id: 'faq', labelKey: 'marketing.nav.faq' },
];

export default function MarketingNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme } = useThemeStore();
  // user === null when logged out, an object when authenticated. We swap the
  // sign-in / get-started CTAs for a single "Open dashboard" link in the
  // logged-in case so an authenticated visitor doesn't see CTAs that don't
  // apply to them. While auth is still resolving we render NEITHER set so
  // the nav doesn't flash sign-in then suddenly show dashboard.
  const { user, isLoading: authLoading } = useAuthStore();
  const isAuthenticated = !!user && !user.mustChangePassword;

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Once the user has scrolled past the gradient hero we swap the translucent
  // chrome for an opaque blurred bar so links and the logo stay legible on the
  // sheet background. Threshold roughly = end of hero on landing.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the drawer is open so the underlying page doesn't
  // jitter behind it on iOS Safari.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [mobileOpen]);

  const onAnchor = (id) => (event) => {
    event.preventDefault();
    setMobileOpen(false);
    if (location.pathname !== '/') {
      navigate(`/#${id}`);
      return;
    }
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isOverHero = !scrolled && location.pathname === '/';
  // Banner choice: white over the green hero OR over a dark-mode page; dark
  // banner only over a light-mode page background.
  const useWhiteBanner = isOverHero || resolvedTheme === 'dark';
  const bannerSrc = useWhiteBanner ? BANNER_WHITE : BANNER_DARK;

  return (
    // Fragment so the MobileDrawer can be a SIBLING of <header>, not a child.
    // The header gets `backdrop-filter` once it's no longer over the hero,
    // and CSS spec says any element with backdrop-filter creates a containing
    // block for its `position: fixed` descendants — which would clip the
    // full-viewport drawer to the nav's bounding box. Rendering the drawer
    // outside <header> dodges that entirely.
    <>
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-all duration-300',
        isOverHero
          ? 'bg-transparent'
          : 'bg-background/85 backdrop-blur-md border-b border-sectionBorder',
      )}
    >
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link
            to="/"
            className="flex items-center shrink-0 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md"
            aria-label="PoultryManager — go to home"
          >
            {/* Full PoultryManager wordmark banner. Two variants are toggled
                purely via the `src` so we get a clean swap on theme change
                without needing CSS image filters or layered images.
                <Link to="/"> already routes to the landing page on click;
                react-router handles SPA navigation so no onClick needed. */}
            <img
              src={bannerSrc}
              alt="PoultryManager"
              className="h-11 md:h-14 w-auto object-contain"
              draggable={false}
            />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ANCHORS.map((item) => (
              <a
                key={item.id}
                href={`/#${item.id}`}
                onClick={onAnchor(item.id)}
                className={cn(
                  'px-3 py-2 rounded-full text-sm font-medium transition-colors',
                  isOverHero
                    ? 'text-white/80 hover:text-white hover:bg-white/[0.12]'
                    : 'text-foreground/70 hover:text-foreground hover:bg-accent',
                )}
              >
                {t(item.labelKey)}
              </a>
            ))}
            <Link
              to="/contact"
              className={cn(
                'px-3 py-2 rounded-full text-sm font-medium transition-colors',
                isOverHero
                  ? 'text-white/80 hover:text-white hover:bg-white/[0.12]'
                  : 'text-foreground/70 hover:text-foreground hover:bg-accent',
              )}
            >
              {t('marketing.nav.contact')}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle variant={isOverHero ? 'hero' : 'default'} />
            <LanguageSwitcher variant={isOverHero ? 'hero' : 'default'} />

            {/* Auth-aware CTAs. Logged-in visitor: single "Open dashboard"
                pill. Logged-out: sign-in link + get-started button. While
                auth is still resolving we show nothing on this slot so we
                don't flash one set then snap to the other. */}
            {authLoading ? null : isAuthenticated ? (
              <Link
                to="/dashboard"
                className={cn(
                  'hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors',
                  isOverHero
                    ? 'bg-white text-primary hover:bg-white/90'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                {t('marketing.nav.dashboard')}
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className={cn(
                    'hidden md:inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                    isOverHero
                      ? 'text-white/80 hover:text-white hover:bg-white/[0.12]'
                      : 'text-foreground/70 hover:text-foreground hover:bg-accent',
                  )}
                >
                  {t('marketing.nav.signIn')}
                </Link>

                <Link
                  to="/register"
                  className={cn(
                    'hidden sm:inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold transition-colors',
                    isOverHero
                      ? 'bg-white text-primary hover:bg-white/90'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {t('marketing.nav.getStarted')}
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className={cn(
                'lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-full',
                isOverHero
                  ? 'bg-white/[0.18] text-white border border-white/15'
                  : 'bg-secondary text-foreground border border-sectionBorder',
              )}
              aria-label={t('marketing.nav.openMenu')}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

    </header>

    {/* Sibling of <header>, NOT a descendant — see the containing-block
        comment above the Fragment opener. */}
    <MobileDrawer
      open={mobileOpen}
      onClose={() => setMobileOpen(false)}
      onAnchor={onAnchor}
      t={t}
      drawerBannerSrc={resolvedTheme === 'dark' ? BANNER_WHITE : BANNER_DARK}
      isAuthenticated={isAuthenticated}
      authLoading={authLoading}
    />
    </>
  );
}

// Slide-in drawer with a proper enter/exit animation. The pattern:
//   - `open` (controlled prop) flips to true  -> mount the DOM, then in the
//     next animation frame flip `showing` true to trigger the CSS transition.
//   - `open` flips to false                   -> flip `showing` false to run
//     the exit transition, then unmount after the duration completes.
// This is the standard "render off-screen first, then animate in" recipe and
// is what tailwindcss-animate's `data-[state=…]` patterns do under the hood.
// We do it by hand here because the drawer isn't wrapped in a Radix primitive.
const DRAWER_DURATION_MS = 280;

function MobileDrawer({ open, onClose, onAnchor, t, drawerBannerSrc, isAuthenticated, authLoading }) {
  const [mounted, setMounted] = useState(false);
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Double requestAnimationFrame is the canonical "wait for one real
      // paint" trick. A single rAF fires BEFORE the next paint, which means
      // React can commit `showing=true` in the same paint cycle as
      // `mounted=true` — the browser never sees the closed state, so there
      // is nothing for the CSS transition to animate from. Wrapping in a
      // second rAF guarantees a paint happens with mounted=true / showing=
      // false first, so the transition has a real "from" state.
      let inner = 0;
      const outer = window.requestAnimationFrame(() => {
        inner = window.requestAnimationFrame(() => setShowing(true));
      });
      return () => {
        window.cancelAnimationFrame(outer);
        if (inner) window.cancelAnimationFrame(inner);
      };
    }
    setShowing(false);
    const t = window.setTimeout(() => setMounted(false), DRAWER_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!mounted) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      <button
        type="button"
        aria-label={t('marketing.nav.closeMenu')}
        className={cn(
          'absolute inset-0 bg-black/50 transition-opacity ease-out',
          showing ? 'opacity-100' : 'opacity-0',
        )}
        style={{ transitionDuration: `${DRAWER_DURATION_MS}ms` }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute inset-y-0 end-0 w-full max-w-[320px] bg-background border-s border-sectionBorder shadow-2xl flex flex-col',
          // RTL aware: drawer slides in from the trailing (end) edge in
          // either direction, so we hide it OFF that same edge when closed.
          'transition-transform ease-out',
          showing ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full',
        )}
        style={{ transitionDuration: `${DRAWER_DURATION_MS}ms` }}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-sectionBorder">
          <Link to="/" onClick={onClose} className="flex items-center" aria-label="PoultryManager — go to home">
            <img src={drawerBannerSrc} alt="PoultryManager" className="h-10 w-auto object-contain" draggable={false} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary border border-sectionBorder"
            aria-label={t('marketing.nav.closeMenu')}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-4">
          <nav className="flex flex-col gap-1">
            {NAV_ANCHORS.map((item) => (
              <a
                key={item.id}
                href={`/#${item.id}`}
                onClick={onAnchor(item.id)}
                className="px-4 py-3 rounded-xl text-base font-medium text-foreground/85 hover:bg-accent text-start"
              >
                {t(item.labelKey)}
              </a>
            ))}
            <Link
              to="/contact"
              onClick={onClose}
              className="px-4 py-3 rounded-xl text-base font-medium text-foreground/85 hover:bg-accent text-start"
            >
              {t('marketing.nav.contact')}
            </Link>
          </nav>
        </div>

        <div className="px-5 py-4 border-t border-sectionBorder flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <ThemeToggle variant="default" />
            <LanguageSwitcher
              variant="default"
              className="flex-1 justify-start"
              alwaysShowLabel
            />
          </div>

          {/* Auth-aware CTAs in the drawer footer (mirrors the desktop nav) */}
          {authLoading ? null : isAuthenticated ? (
            <Link
              to="/dashboard"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-2xl bg-primary text-primary-foreground font-semibold"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              {t('marketing.nav.dashboard')}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                onClick={onClose}
                className="inline-flex items-center justify-center w-full h-11 rounded-2xl bg-secondary text-secondary-foreground font-medium"
              >
                {t('marketing.nav.signIn')}
              </Link>
              <Link
                to="/register"
                onClick={onClose}
                className="inline-flex items-center justify-center w-full h-11 rounded-2xl bg-primary text-primary-foreground font-semibold"
              >
                {t('marketing.nav.getStarted')}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
