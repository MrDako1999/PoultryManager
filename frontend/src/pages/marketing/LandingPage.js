import LandingHero from '@/components/marketing/LandingHero';
import ModuleShowcase from '@/components/marketing/ModuleShowcase';
import HowItWorks from '@/components/marketing/HowItWorks';
import PricingComingSoon from '@/components/marketing/PricingComingSoon';
import MobileAppsBlock from '@/components/marketing/MobileAppsBlock';
import FaqAccordion from '@/components/marketing/FaqAccordion';
import CtaFooter from '@/components/marketing/CtaFooter';

// Marketing landing composition. Visual rhythm alternates between the
// transparent page background and a subtle tinted band so the eye gets a
// natural "section / break / section" cadence as it scrolls.
//
//   1. LandingHero               — gradient + module hub diagram
//   2. ModuleShowcase            — every module as a row card (mirrors mobile)
//   3. HowItWorks                — owner / worker two-up
//   4. PricingComingSoon         — single placeholder card
//   5. MobileAppsBlock (tinted)  — both stores coming soon
//   6. FaqAccordion              — frequently asked questions
//   7. CtaFooter                 — final dark gradient band
export default function LandingPage() {
  return (
    <>
      <LandingHero />
      <ModuleShowcase />
      <HowItWorks />
      <PricingComingSoon />
      <MobileAppsBlock />
      <FaqAccordion />
      <CtaFooter />
    </>
  );
}
