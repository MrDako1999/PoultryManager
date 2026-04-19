import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react-native';
import EmptyState from '@/components/ui/EmptyState';

export default function StatementsListView() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-background">
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
