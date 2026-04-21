import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { isRTL } from '@/i18n/languages';

// Mirrors the mobile DESIGN_LANGUAGE.md §12 contract on the web:
//   - documentElement.lang        -> i18n.language (drives the Cairo fallback for ar/ur)
//   - documentElement.dir         -> 'rtl' for Arabic / Urdu, otherwise 'ltr'
//
// Mounted once at the top of <App> so every screen — marketing AND dashboard —
// gets the same direction handling. Tailwind's logical utilities (ms-*, me-*,
// ps-*, pe-*, text-start, text-end, border-s, border-e, rounded-s-*) all read
// from `[dir]` on the html element, so flipping this attribute is enough to
// flip every component that follows the logical-edges rule.
export default function useDocumentDir() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const lang = i18n.language || 'en';
    const root = document.documentElement;
    if (root.lang !== lang) root.lang = lang;
    const nextDir = isRTL(lang) ? 'rtl' : 'ltr';
    if (root.dir !== nextDir) root.dir = nextDir;
  }, [i18n.language]);
}
