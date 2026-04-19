import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { useIsRTL } from '@/stores/localeStore';

const RULES = [
  { key: 'length', test: (pw) => pw.length >= 8, labelKey: 'auth.pwRuleLength' },
  { key: 'uppercase', test: (pw) => /[A-Z]/.test(pw), labelKey: 'auth.pwRuleUppercase' },
  { key: 'number', test: (pw) => /\d/.test(pw), labelKey: 'auth.pwRuleNumber' },
  { key: 'special', test: (pw) => /[^A-Za-z0-9]/.test(pw), labelKey: 'auth.pwRuleSpecial' },
];

const STRENGTH_CONFIG = [
  { min: 0, label: 'auth.pwWeak', color: 'bg-red-500' },
  { min: 1, label: 'auth.pwWeak', color: 'bg-red-500' },
  { min: 2, label: 'auth.pwFair', color: 'bg-orange-500' },
  { min: 3, label: 'auth.pwGood', color: 'bg-yellow-500' },
  { min: 4, label: 'auth.pwStrong', color: 'bg-green-500' },
];

export default function PasswordStrength({ password }) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const row = isRTL ? 'flex-row-reverse' : 'flex-row';

  const { passed, score } = useMemo(() => {
    if (!password) return { passed: [], score: 0 };
    const p = RULES.filter((r) => r.test(password));
    return { passed: p.map((r) => r.key), score: p.length };
  }, [password]);

  if (!password) return null;

  const config = STRENGTH_CONFIG[score];

  return (
    <View className="gap-2.5 pt-1">
      <View className={cn(row, 'items-center gap-2')}>
        <View className={cn(row, 'flex-1 gap-1')}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                i < score ? config.color : 'bg-muted'
              )}
            />
          ))}
        </View>
        <Text
          className={cn(
            'text-xs font-medium',
            score <= 1 && 'text-red-500',
            score === 2 && 'text-orange-500',
            score === 3 && 'text-yellow-600',
            score === 4 && 'text-green-600'
          )}
        >
          {t(config.label)}
        </Text>
      </View>
      <View className={cn(row, 'flex-wrap gap-y-1')}>
        {RULES.map((rule) => {
          const ok = passed.includes(rule.key);
          return (
            <View key={rule.key} className={cn(row, 'w-1/2 items-center gap-1.5')}>
              {ok ? (
                <Check size={12} color="#16a34a" />
              ) : (
                <X size={12} color="hsl(150, 10%, 45%)" />
              )}
              <Text
                className={cn(
                  'text-xs',
                  ok ? 'text-green-600' : 'text-muted-foreground'
                )}
              >
                {t(rule.labelKey)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
