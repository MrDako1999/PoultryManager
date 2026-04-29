import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, X } from 'lucide-react';
import db from '@/lib/db';
import useSettings from '@/hooks/useSettings';
import EnumButtonSelect from '@/components/EnumButtonSelect';
import {
  DEFAULT_WEIGHT_BANDS, generateWeightBands, formatBandLabel,
} from '@/modules/slaughterhouse/lib/defaultWeightBands';
import { DEFAULT_SHELF_LIFE_DAYS } from '@/modules/slaughterhouse/lib/expiry';

const PART_TYPES = [
  'BREAST', 'WHOLE_LEG', 'DRUMSTICK', 'SKIN_THIGHS', 'WINGS',
  'BONELESS_THIGH', 'NECK', 'BONE', 'MEAT_MINCE', 'BRAAI', 'CUT_PIC',
];

const GIBLET_TYPES = ['LIVER', 'GIZZARD', 'HEART'];

const DEFAULT_PRICING = {
  mode: 'PER_UNIT',
  tiers: {
    A: { label: 'Whole Chickens', rate: 1.25 },
    B: { label: 'Giblets', rate: 0.5 },
    C: { label: 'Portions', rate: 1.0 },
  },
};

// Slaughterhouse-only settings. Stored locally in db.settings under
// the 'slaughterhouse' key (offline-first; same shape as 'saleDefaults'
// and 'accounting'). When the backend lands, mirror via api.put as the
// other settings pages do.
export default function SlaughterhouseSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const accounting = useSettings('accounting');
  const settings = useSettings('slaughterhouse');
  const currency = accounting?.currency || 'AED';

  const [minGrams, setMinGrams] = useState(String(DEFAULT_WEIGHT_BANDS.minGrams));
  const [maxGrams, setMaxGrams] = useState(String(DEFAULT_WEIGHT_BANDS.maxGrams));
  const [stepGrams, setStepGrams] = useState(String(DEFAULT_WEIGHT_BANDS.stepGrams));
  const [customBands, setCustomBands] = useState([]);
  const [newCustomBand, setNewCustomBand] = useState('');

  const [defaultBirdsPerBox, setDefaultBirdsPerBox] = useState('10');

  const [shelfLifeBoxes, setShelfLifeBoxes] = useState(String(DEFAULT_SHELF_LIFE_DAYS.boxes));
  const [shelfLifePortions, setShelfLifePortions] = useState(String(DEFAULT_SHELF_LIFE_DAYS.portions));
  const [shelfLifeGiblets, setShelfLifeGiblets] = useState(String(DEFAULT_SHELF_LIFE_DAYS.giblets));

  const [enabledPartTypes, setEnabledPartTypes] = useState(PART_TYPES);
  const [enabledGiblets, setEnabledGiblets] = useState(GIBLET_TYPES);

  const [pricingMode, setPricingMode] = useState(DEFAULT_PRICING.mode);
  const [tierA, setTierA] = useState(DEFAULT_PRICING.tiers.A);
  const [tierB, setTierB] = useState(DEFAULT_PRICING.tiers.B);
  const [tierC, setTierC] = useState(DEFAULT_PRICING.tiers.C);

  const [requireApprovalToClose, setRequireApprovalToClose] = useState(true);

  const [saving, setSaving] = useState(false);

  // Hydrate state from useSettings on first load (and whenever it changes).
  useEffect(() => {
    if (!settings) return;
    if (settings.weightBands) {
      setMinGrams(String(settings.weightBands.minGrams ?? DEFAULT_WEIGHT_BANDS.minGrams));
      setMaxGrams(String(settings.weightBands.maxGrams ?? DEFAULT_WEIGHT_BANDS.maxGrams));
      setStepGrams(String(settings.weightBands.stepGrams ?? DEFAULT_WEIGHT_BANDS.stepGrams));
      setCustomBands(Array.isArray(settings.weightBands.customBands) ? settings.weightBands.customBands : []);
    }
    if (settings.defaultBirdsPerBox != null) setDefaultBirdsPerBox(String(settings.defaultBirdsPerBox));
    if (settings.defaultShelfLifeDays) {
      setShelfLifeBoxes(String(settings.defaultShelfLifeDays.boxes ?? DEFAULT_SHELF_LIFE_DAYS.boxes));
      setShelfLifePortions(String(settings.defaultShelfLifeDays.portions ?? DEFAULT_SHELF_LIFE_DAYS.portions));
      setShelfLifeGiblets(String(settings.defaultShelfLifeDays.giblets ?? DEFAULT_SHELF_LIFE_DAYS.giblets));
    }
    if (Array.isArray(settings.enabledPartTypes)) setEnabledPartTypes(settings.enabledPartTypes);
    if (Array.isArray(settings.enabledGiblets)) setEnabledGiblets(settings.enabledGiblets);
    if (settings.pricing) {
      setPricingMode(settings.pricing.mode || DEFAULT_PRICING.mode);
      setTierA({ ...DEFAULT_PRICING.tiers.A, ...(settings.pricing.tiers?.A || {}) });
      setTierB({ ...DEFAULT_PRICING.tiers.B, ...(settings.pricing.tiers?.B || {}) });
      setTierC({ ...DEFAULT_PRICING.tiers.C, ...(settings.pricing.tiers?.C || {}) });
    }
    if (settings.reconciliation?.requireApprovalToClose != null) {
      setRequireApprovalToClose(!!settings.reconciliation.requireApprovalToClose);
    }
  }, [settings]);

  const previewBands = useMemo(
    () => generateWeightBands({
      minGrams: Number(minGrams) || 0,
      maxGrams: Number(maxGrams) || 0,
      stepGrams: Number(stepGrams) || 0,
      customBands,
    }),
    [minGrams, maxGrams, stepGrams, customBands],
  );

  const togglePartType = (key) => {
    setEnabledPartTypes((prev) => (prev.includes(key)
      ? prev.filter((k) => k !== key)
      : [...prev, key]));
  };

  const toggleGiblet = (key) => {
    setEnabledGiblets((prev) => (prev.includes(key)
      ? prev.filter((k) => k !== key)
      : [...prev, key]));
  };

  const addCustomBand = () => {
    const n = Number(newCustomBand);
    if (!Number.isFinite(n) || n <= 0) return;
    if (customBands.includes(n)) {
      setNewCustomBand('');
      return;
    }
    setCustomBands((prev) => [...prev, n].sort((a, b) => a - b));
    setNewCustomBand('');
  };

  const removeCustomBand = (band) => {
    setCustomBands((prev) => prev.filter((b) => b !== band));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        weightBands: {
          minGrams: Number(minGrams) || DEFAULT_WEIGHT_BANDS.minGrams,
          maxGrams: Number(maxGrams) || DEFAULT_WEIGHT_BANDS.maxGrams,
          stepGrams: Number(stepGrams) || DEFAULT_WEIGHT_BANDS.stepGrams,
          customBands,
        },
        defaultBirdsPerBox: Number(defaultBirdsPerBox) || 10,
        defaultShelfLifeDays: {
          boxes: Number(shelfLifeBoxes) || DEFAULT_SHELF_LIFE_DAYS.boxes,
          portions: Number(shelfLifePortions) || DEFAULT_SHELF_LIFE_DAYS.portions,
          giblets: Number(shelfLifeGiblets) || DEFAULT_SHELF_LIFE_DAYS.giblets,
        },
        enabledPartTypes,
        enabledGiblets,
        pricing: {
          mode: pricingMode,
          tiers: {
            A: { label: tierA.label || DEFAULT_PRICING.tiers.A.label, rate: Number(tierA.rate) || 0 },
            B: { label: tierB.label || DEFAULT_PRICING.tiers.B.label, rate: Number(tierB.rate) || 0 },
            C: { label: tierC.label || DEFAULT_PRICING.tiers.C.label, rate: Number(tierC.rate) || 0 },
          },
        },
        reconciliation: {
          requireApprovalToClose,
        },
      };
      // Frontend-only this round — store locally. When the backend
      // lands, mirror via api.put('/settings/slaughterhouse', payload).
      await db.settings.put({ key: 'slaughterhouse', value: payload });
      toast({ title: t('settings.slaughterhouseUpdated', 'Slaughterhouse settings updated') });
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err?.message || t('settings.slaughterhouseUpdateError', 'Failed to save slaughterhouse settings'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const pricingModeOptions = useMemo(() => [
    { value: 'PER_UNIT', label: t('settings.pricingModePerUnit', 'Per unit') },
    { value: 'LUMP_SUM', label: t('settings.pricingModeLumpSum', 'Lump sum') },
  ], [t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.slaughterhouseTitle', 'Slaughterhouse')}</CardTitle>
        <CardDescription>
          {t('settings.slaughterhouseDesc', 'Tune weight bands, expiry defaults, pricing tiers and reconciliation rules.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Weight bands */}
        <div>
          <h3 className="text-sm font-medium mb-1">{t('settings.weightBands', 'Weight bands')}</h3>
          <p className="text-xs text-muted-foreground mb-3">
            {t('settings.weightBandsHint', 'Boxes are sorted into these weight bands during packing.')}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('settings.minGrams', 'Min (g)')}</Label>
              <Input
                type="number" min="0" step="50"
                value={minGrams}
                onChange={(e) => setMinGrams(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('settings.maxGrams', 'Max (g)')}</Label>
              <Input
                type="number" min="0" step="50"
                value={maxGrams}
                onChange={(e) => setMaxGrams(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('settings.stepGrams', 'Step (g)')}</Label>
              <Input
                type="number" min="1" step="10"
                value={stepGrams}
                onChange={(e) => setStepGrams(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label className="text-xs">{t('settings.customBands', 'Custom bands')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {customBands.length === 0 && (
                <span className="text-xs text-muted-foreground">—</span>
              )}
              {customBands.map((band) => (
                <span
                  key={band}
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"
                >
                  {formatBandLabel(band)}
                  <button
                    type="button"
                    aria-label={`Remove ${formatBandLabel(band)}`}
                    onClick={() => removeCustomBand(band)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 max-w-xs">
              <Input
                type="number" min="0" step="50"
                placeholder="g"
                value={newCustomBand}
                onChange={(e) => setNewCustomBand(e.target.value)}
              />
              <Button type="button" variant="outline" size="icon" onClick={addCustomBand}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t('settings.weightBandsPreview', 'Preview')}: {previewBands.length}{' '}
              {t('settings.bands', 'bands')} —{' '}
              <span className="text-muted-foreground">
                {previewBands.slice(0, 8).map(formatBandLabel).join(', ')}
                {previewBands.length > 8 ? '…' : ''}
              </span>
            </p>
          </div>
        </div>

        <Separator />

        {/* Default birds per box */}
        <div>
          <h3 className="text-sm font-medium mb-3">{t('settings.defaultBirdsPerBox', 'Default birds per box')}</h3>
          <div className="max-w-xs space-y-1">
            <Input
              type="number" min="1" step="1"
              value={defaultBirdsPerBox}
              onChange={(e) => setDefaultBirdsPerBox(e.target.value)}
            />
          </div>
        </div>

        <Separator />

        {/* Default shelf life */}
        <div>
          <h3 className="text-sm font-medium mb-3">{t('settings.defaultShelfLifeDays', 'Default shelf life')}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('settings.shelfLifeBoxes', 'Whole-chicken boxes (days)')}</Label>
              <Input
                type="number" min="1" step="1"
                value={shelfLifeBoxes}
                onChange={(e) => setShelfLifeBoxes(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('settings.shelfLifePortions', 'Portions (days)')}</Label>
              <Input
                type="number" min="1" step="1"
                value={shelfLifePortions}
                onChange={(e) => setShelfLifePortions(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('settings.shelfLifeGiblets', 'Giblets (days)')}</Label>
              <Input
                type="number" min="1" step="1"
                value={shelfLifeGiblets}
                onChange={(e) => setShelfLifeGiblets(e.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Enabled part types */}
        <div>
          <h3 className="text-sm font-medium mb-3">{t('settings.enabledPartTypes', 'Enabled portion types')}</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PART_TYPES.map((key) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/50"
              >
                <Checkbox
                  checked={enabledPartTypes.includes(key)}
                  onCheckedChange={() => togglePartType(key)}
                />
                <span className="text-sm">
                  {t(`production.partTypes.${key}`, key)}
                </span>
              </label>
            ))}
          </div>
        </div>

        <Separator />

        {/* Enabled giblets */}
        <div>
          <h3 className="text-sm font-medium mb-3">{t('settings.enabledGiblets', 'Enabled giblets')}</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {GIBLET_TYPES.map((key) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent/50"
              >
                <Checkbox
                  checked={enabledGiblets.includes(key)}
                  onCheckedChange={() => toggleGiblet(key)}
                />
                <span className="text-sm">
                  {t(`production.giblets.${key}`, key)}
                </span>
              </label>
            ))}
          </div>
        </div>

        <Separator />

        {/* Pricing */}
        <div>
          <h3 className="text-sm font-medium mb-1">{t('settings.pricing', 'Pricing')}</h3>
          <p className="text-xs text-muted-foreground mb-3">
            {t('settings.pricingHint', 'Per-unit computes from production rows. Lump-sum lets the operator type agreed amounts.')}
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('settings.pricingMode', 'Mode')}</Label>
              <EnumButtonSelect
                options={pricingModeOptions}
                value={pricingMode}
                onChange={setPricingMode}
                columns={2}
                compact
                className="max-w-xs"
              />
            </div>

            {[
              { key: 'A', state: tierA, setter: setTierA },
              { key: 'B', state: tierB, setter: setTierB },
              { key: 'C', state: tierC, setter: setTierC },
            ].map(({ key, state, setter }) => (
              <div key={key} className="grid gap-2 sm:grid-cols-[1fr_120px]">
                <div className="space-y-1">
                  <Label className="text-xs">
                    {t('settings.tierLabel', 'Label')} — Tier {key}
                  </Label>
                  <Input
                    value={state.label}
                    onChange={(e) => setter({ ...state, label: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('settings.tierRate', 'Default rate')}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {currency}
                    </span>
                    <Input
                      type="number" min="0" step="0.01"
                      value={state.rate}
                      onChange={(e) => setter({ ...state, rate: e.target.value })}
                      className="pl-12"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Reconciliation */}
        <div>
          <h3 className="text-sm font-medium mb-3">{t('settings.reconciliation', 'Reconciliation')}</h3>
          <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50">
            <Switch
              checked={requireApprovalToClose}
              onCheckedChange={setRequireApprovalToClose}
            />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {t('settings.requireApprovalToClose', 'Require supervisor approval when variance is not zero')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('settings.requireApprovalToCloseHint', 'When enabled, jobs with a non-zero variance need a supervisor signature + note before they can close.')}
              </p>
            </div>
          </label>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
