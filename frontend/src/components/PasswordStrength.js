import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const RULES = [
  { key: 'length', test: (pw) => pw.length >= 8, labelKey: 'auth.pwRuleLength' },
  { key: 'uppercase', test: (pw) => /[A-Z]/.test(pw), labelKey: 'auth.pwRuleUppercase' },
  { key: 'number', test: (pw) => /\d/.test(pw), labelKey: 'auth.pwRuleNumber' },
  { key: 'special', test: (pw) => /[^A-Za-z0-9]/.test(pw), labelKey: 'auth.pwRuleSpecial' },
];

const STRENGTH_CONFIG = [
  { min: 0, label: 'auth.pwWeak', color: 'bg-destructive' },
  { min: 1, label: 'auth.pwWeak', color: 'bg-destructive' },
  { min: 2, label: 'auth.pwFair', color: 'bg-warning' },
  { min: 3, label: 'auth.pwGood', color: 'bg-warning' },
  { min: 4, label: 'auth.pwStrong', color: 'bg-success' },
];

export default function PasswordStrength({ password }) {
  const { t } = useTranslation();

  const { passed, score } = useMemo(() => {
    if (!password) return { passed: [], score: 0 };
    const p = RULES.filter((r) => r.test(password));
    return { passed: p.map((r) => r.key), score: p.length };
  }, [password]);

  if (!password) return null;

  const config = STRENGTH_CONFIG[score];

  return (
    <div className="space-y-2.5 pt-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-300',
                i < score ? config.color : 'bg-muted'
              )}
            />
          ))}
        </div>
        <span className={cn('text-xs font-medium', score <= 1 && 'text-destructive', score === 2 && 'text-warning', score === 3 && 'text-warning', score === 4 && 'text-success')}>
          {t(config.label)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {RULES.map((rule) => {
          const ok = passed.includes(rule.key);
          return (
            <div key={rule.key} className="flex items-center gap-1.5">
              {ok ? (
                <Check className="h-3 w-3 text-success shrink-0" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              )}
              <span
                className={cn(
                  'text-xs transition-colors',
                  ok ? 'text-success' : 'text-muted-foreground'
                )}
              >
                {t(rule.labelKey)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
