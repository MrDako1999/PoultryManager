import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, MapPin } from 'lucide-react';
import useThemeStore from '@/stores/themeStore';

// Sits at the bottom of every marketing page. Three link columns + a brand
// strip. Layout uses logical edges (text-start, ms/me) so the columns flip
// cleanly in RTL.
export default function MarketingFooter() {
  const { t } = useTranslation();
  const { resolvedTheme } = useThemeStore();
  // Footer always sits on the page background — pick the banner that
  // contrasts: white over dark, dark over light.
  const bannerSrc = resolvedTheme === 'dark'
    ? '/media/logo/PM_banner_white.png'
    : '/media/logo/PM_Banner.png';

  return (
    <footer className="border-t border-sectionBorder bg-background">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <Link to="/" className="inline-flex items-center transition-opacity hover:opacity-90" aria-label="PoultryManager — go to home">
              <img
                src={bannerSrc}
                alt="PoultryManager"
                className="h-12 md:h-14 w-auto object-contain"
                draggable={false}
              />
            </Link>
            <p className="mt-4 text-sm text-muted-foreground max-w-md text-start">
              {t('marketing.footer.tagline')}
            </p>
            <p className="mt-2 text-xs text-muted-foreground/80 text-start">
              {t('marketing.footer.operatedBy')}
            </p>

            <div className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground">
              <a
                href="mailto:info@esteratech.com"
                className="inline-flex items-center gap-2 hover:text-foreground transition-colors"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                <span>info@esteratech.com</span>
              </a>
              <a
                href="https://wa.me/971522444195"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-foreground transition-colors"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                <span dir="ltr">+971 52 244 4195</span>
              </a>
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                <span>{t('marketing.contact.location')}</span>
              </span>
            </div>
          </div>

          <FooterColumn title={t('marketing.footer.product.title')}>
            <FooterAnchor href="/#modules">{t('marketing.footer.product.modules')}</FooterAnchor>
            <FooterAnchor href="/#pricing">{t('marketing.footer.product.pricing')}</FooterAnchor>
            <FooterAnchor href="/#mobile-apps">{t('marketing.footer.product.mobileApps')}</FooterAnchor>
          </FooterColumn>

          <FooterColumn title={t('marketing.footer.company.title')}>
            <FooterLink to="/contact">{t('marketing.footer.company.contact')}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t('marketing.footer.legal.title')}>
            <FooterLink to="/privacy">{t('marketing.footer.legal.privacy')}</FooterLink>
            <FooterLink to="/terms">{t('marketing.footer.legal.terms')}</FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-12 pt-6 border-t border-sectionBorder flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-muted-foreground">
          <span>{t('marketing.footer.rights')}</span>
          <span className="opacity-70">v1.0.2</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }) {
  return (
    <div className="md:col-span-2 lg:col-span-2">
      <h3 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-3">
        {title}
      </h3>
      <ul className="flex flex-col gap-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }) {
  return (
    <li>
      <Link to={to} className="text-foreground/80 hover:text-foreground transition-colors">
        {children}
      </Link>
    </li>
  );
}

function FooterAnchor({ href, children }) {
  return (
    <li>
      <a href={href} className="text-foreground/80 hover:text-foreground transition-colors">
        {children}
      </a>
    </li>
  );
}
