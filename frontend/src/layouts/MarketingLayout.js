import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';

// Wrapper for every public marketing route (/, /privacy, /terms, /contact).
// Nav + Footer chrome lives here; each Outlet page paints its own gradient
// hero + sheet body so the hero can carry per-page art (the module hub on
// landing, an icon-tile on the legal/contact pages).
//
// Direction wiring (html[dir]+html[lang]) is handled globally by
// useDocumentDir() inside <App>, so we don't repeat it here.
export default function MarketingLayout() {
  const { pathname, hash } = useLocation();

  // Scroll to the hash target when the URL changes (covers landing-page
  // anchors when arriving from another marketing page) or to the top when
  // navigating to a new pathname without a hash. Without this, react-router
  // leaves the scroll position wherever it was on the previous page.
  useEffect(() => {
    if (hash) {
      const id = hash.replace(/^#/, '');
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname, hash]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <MarketingNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <MarketingFooter />
    </div>
  );
}
