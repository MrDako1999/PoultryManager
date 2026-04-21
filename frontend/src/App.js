import { useEffect, createElement } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from '@/stores/authStore';
import useThemeStore from '@/stores/themeStore';
import useCapabilities from '@/hooks/useCapabilities';
import useDocumentDir from '@/hooks/useDocumentDir';
import AuthLayout from '@/layouts/AuthLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import MarketingLayout from '@/layouts/MarketingLayout';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import FirstLoginPage from '@/pages/auth/FirstLoginPage';
import LandingPage from '@/pages/marketing/LandingPage';
import PrivacyPage from '@/pages/marketing/PrivacyPage';
import TermsPage from '@/pages/marketing/TermsPage';
import ContactPage from '@/pages/marketing/ContactPage';
import AccountDeletionPage from '@/pages/marketing/AccountDeletionPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import AccountingShell from '@/pages/dashboard/AccountingShell';
import SettingsPage from '@/pages/dashboard/settings/SettingsPage';
import ContactsPage from '@/shared/pages/directory/ContactsPage';
import BusinessesPage from '@/shared/pages/directory/BusinessesPage';
import WorkersPage from '@/shared/pages/directory/WorkersPage';
import FarmsPage from '@/shared/pages/directory/FarmsPage';
import FeedCataloguePage from '@/shared/pages/directory/FeedCataloguePage';
import BusinessDetailLayout from '@/shared/pages/directory/BusinessDetailLayout';
import BusinessOverview from '@/shared/pages/directory/BusinessOverview';
import FarmDetailLayout from '@/shared/pages/directory/FarmDetailLayout';
import FarmOverview from '@/shared/pages/directory/FarmOverview';
import RequireCapability from '@/components/RequireCapability';
import { MODULES } from '@/modules/registry';
import { Toaster } from '@/components/ui/toaster';
import { Construction } from 'lucide-react';

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/first-login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user && !user.mustChangePassword) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function PlaceholderPage({ title }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Construction className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        This feature is currently under development and will be available in a future update.
      </p>
    </div>
  );
}

// Recursively render a module's route tree into <Route> elements. Each route
// is wrapped in <RequireCapability> using its `capability` field.
function renderModuleRoutes(routes) {
  return routes.flatMap((r, idx) => {
    const children = Array.isArray(r.children) ? r.children : [];
    const ElementComponent = r.element;
    const guardedElement = ElementComponent
      ? (
        <RequireCapability action={r.capability}>
          {createElement(ElementComponent)}
        </RequireCapability>
      )
      : null;

    if (r.index) {
      return <Route key={`idx-${idx}`} index element={guardedElement} />;
    }

    return (
      <Route key={r.path} path={r.path} element={guardedElement}>
        {children.length > 0 ? renderModuleRoutes(children) : null}
      </Route>
    );
  });
}

// Partition module routes: top-level vs business-scoped (which need to be
// nested under the shared BusinessDetailLayout so <Outlet> works).
function partitionModuleRoutes(routes) {
  const topLevel = [];
  const businessScoped = [];
  for (const r of routes) {
    if (r.businessScoped) {
      // Convert the absolute path to a relative child under :id/
      const match = r.path.match(/^\/dashboard\/directory\/businesses\/:id\/(.+)$/);
      if (match) {
        businessScoped.push({ ...r, path: match[1] });
        continue;
      }
    }
    topLevel.push(r);
  }
  return { topLevel, businessScoped };
}

function useModuleRouteTree() {
  const { visibleModules } = useCapabilities();
  const routes = visibleModules.flatMap((id) => MODULES[id]?.routes || []);
  return partitionModuleRoutes(routes);
}

export default function App() {
  const { checkAuth } = useAuthStore();
  const { initTheme } = useThemeStore();
  const { topLevel: moduleTopLevelRoutes, businessScoped: moduleBusinessScopedRoutes } = useModuleRouteTree();

  useDocumentDir();

  useEffect(() => {
    initTheme();
    checkAuth();
  }, [checkAuth, initTheme]);

  return (
    <>
      <Routes>
        {/* Public marketing routes — no PublicRoute wrapper because landing,
            privacy, terms and contact must be reachable for both anonymous
            users AND authenticated users (so they can read the policy or jump
            to the home page from inside the dashboard). */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/account-deletion" element={<AccountDeletionPage />} />
        </Route>

        {/* Public auth routes */}
        <Route
          element={
            <PublicRoute>
              <AuthLayout />
            </PublicRoute>
          }
        >
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* First-login password change — public layout but only reachable when
            ProtectedRoute redirects an authenticated user with mustChangePassword */}
        <Route element={<AuthLayout />}>
          <Route path="/first-login" element={<FirstLoginPage />} />
        </Route>

        {/* Protected dashboard routes */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* Shell */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/settings" element={<SettingsPage />} />

          {/* Top-level module-contributed routes */}
          {renderModuleRoutes(moduleTopLevelRoutes)}

          {/* Legacy redirects */}
          <Route path="/dashboard/farms" element={<Navigate to="/dashboard/directory/farms" replace />} />
          <Route path="/dashboard/workers" element={<Navigate to="/dashboard/directory/workers" replace />} />
          <Route path="/dashboard/health" element={<PlaceholderPage title="Health & Medicine" />} />

          {/* Always-on directory routes (shared) — each child-entity gated by capability */}
          <Route path="/dashboard/directory" element={<PlaceholderPage title="Directory" />} />
          <Route path="/dashboard/directory/contacts" element={
            <RequireCapability action="contact:read"><ContactsPage /></RequireCapability>
          } />
          <Route path="/dashboard/directory/businesses" element={
            <RequireCapability action="business:read"><BusinessesPage /></RequireCapability>
          } />
          <Route path="/dashboard/directory/businesses/:id" element={
            <RequireCapability action="business:read"><BusinessDetailLayout /></RequireCapability>
          }>
            <Route index element={<BusinessOverview />} />
            {renderModuleRoutes(moduleBusinessScopedRoutes)}
          </Route>
          <Route path="/dashboard/directory/workers" element={
            <RequireCapability action="worker:read"><WorkersPage /></RequireCapability>
          } />
          <Route path="/dashboard/directory/farms" element={
            <RequireCapability action="farm:read"><FarmsPage /></RequireCapability>
          } />
          <Route path="/dashboard/directory/farms/:farmId" element={
            <RequireCapability action="farm:read"><FarmDetailLayout /></RequireCapability>
          }>
            <Route index element={<FarmOverview />} />
          </Route>
          <Route path="/dashboard/directory/feed" element={
            <RequireCapability action="feedItem:read"><FeedCataloguePage /></RequireCapability>
          } />

          {/* Accounting shell — tabs contributed by each module's accountingTabs */}
          <Route path="/dashboard/accounting" element={<AccountingShell />} />
          <Route path="/dashboard/accounting/:tabId" element={<AccountingShell />} />
          <Route path="/dashboard/accounting/:tabId/:recordId" element={<AccountingShell />} />

          {/* Unimplemented accounting subsections */}
          <Route path="/dashboard/accounting/vat" element={<PlaceholderPage title="VAT" />} />
          <Route path="/dashboard/accounting/corporate-tax" element={<PlaceholderPage title="Corporate Tax" />} />

          {/* Legacy redirects */}
          <Route path="/dashboard/sales" element={<Navigate to="/dashboard/accounting/sales" replace />} />
          <Route path="/dashboard/invoices" element={<Navigate to="/dashboard/accounting/sales" replace />} />
        </Route>

        {/* Catch-all — unknown URLs land on the marketing site, not /login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}
