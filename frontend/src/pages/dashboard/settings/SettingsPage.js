import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Shield, Users, Boxes, CreditCard, Calculator, ShoppingCart } from 'lucide-react';
import useCapabilities from '@/hooks/useCapabilities';
import ProfileSettings from './ProfileSettings';
import SecuritySettings from './SecuritySettings';
import TeamSettings from './TeamSettings';
import ModulesSettings from './ModulesSettings';
import AccountingSettings from './AccountingSettings';
import SaleDefaultsSettings from './SaleDefaultsSettings';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { workspace, can } = useCapabilities();
  const isOwner = !!workspace?.isOwner;
  const canEditAccounting = isOwner || can('settings:accounting:read');
  const canEditSaleDefaults = isOwner || can('settings:saleDefaults:read');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">
          {t('settings.title')}
        </h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger
            value="profile"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.profile')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
          >
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.security')}</span>
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger
              value="team"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">{t('settings.team')}</span>
            </TabsTrigger>
          )}
          {isOwner && (
            <TabsTrigger
              value="modules"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <Boxes className="h-4 w-4" />
              <span className="hidden sm:inline">{t('settings.modules')}</span>
            </TabsTrigger>
          )}
          {canEditAccounting && (
            <TabsTrigger
              value="accounting"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">{t('settings.accounting')}</span>
            </TabsTrigger>
          )}
          {canEditSaleDefaults && (
            <TabsTrigger
              value="saleDefaults"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">{t('settings.saleDefaults')}</span>
            </TabsTrigger>
          )}
          <TabsTrigger
            value="billing"
            disabled
            className="gap-2 opacity-50"
          >
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">{t('settings.billing')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySettings />
        </TabsContent>

        {isOwner && (
          <TabsContent value="team">
            <TeamSettings />
          </TabsContent>
        )}

        {isOwner && (
          <TabsContent value="modules">
            <ModulesSettings />
          </TabsContent>
        )}

        {canEditAccounting && (
          <TabsContent value="accounting">
            <AccountingSettings />
          </TabsContent>
        )}

        {canEditSaleDefaults && (
          <TabsContent value="saleDefaults">
            <SaleDefaultsSettings />
          </TabsContent>
        )}

        <TabsContent value="billing">
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-2">
              <CreditCard className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">{t('settings.billingComingSoon')}</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
