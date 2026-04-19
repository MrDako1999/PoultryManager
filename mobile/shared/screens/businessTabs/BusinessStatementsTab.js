import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react-native';
import { useHeroSheetTokens } from '@/components/HeroSheetScreen';
import EmptyState from '@/components/ui/EmptyState';

/**
 * Statements tab inside the Business Detail pager. Currently renders the
 * coming-soon empty state — kept as a thin token-aware wrapper so we can
 * swap in a real statements feed later without changing the orchestrator.
 */
export default function BusinessStatementsTab() {
  const { t } = useTranslation();
  const { screenBg } = useHeroSheetTokens();
  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <EmptyState
        icon={FileText}
        title={t('businesses.statementsComingSoon', 'Statements coming soon')}
        description={t(
          'businesses.statementsComingSoonDesc',
          'Generate statements from the desktop dashboard for now.'
        )}
      />
    </View>
  );
}
