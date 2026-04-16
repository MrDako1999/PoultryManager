import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from '@/stores/authStore';
import useThemeStore from '@/stores/themeStore';
import AuthLayout from '@/layouts/AuthLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import SettingsPage from '@/pages/dashboard/settings/SettingsPage';
import ContactsPage from '@/pages/dashboard/directory/ContactsPage';
import BusinessesPage from '@/pages/dashboard/directory/BusinessesPage';
import WorkersPage from '@/pages/dashboard/directory/WorkersPage';
import FarmsPage from '@/pages/dashboard/directory/FarmsPage';
import FeedCataloguePage from '@/pages/dashboard/directory/FeedCataloguePage';
import BatchesPage from '@/pages/dashboard/BatchesPage';
import BatchDetailLayout from '@/pages/dashboard/batch/BatchDetailLayout';
import BatchOverview from '@/pages/dashboard/batch/BatchOverview';
import BatchExpensesView from '@/pages/dashboard/batch/BatchExpensesView';
import BatchSourcesView from '@/pages/dashboard/batch/BatchSourcesView';
import BatchFeedOrdersView from '@/pages/dashboard/batch/BatchFeedOrdersView';
import BatchSalesView from '@/pages/dashboard/batch/BatchSalesView';
import BatchOperationsView from '@/pages/dashboard/batch/BatchOperationsView';
import BatchHouseOpsView from '@/pages/dashboard/batch/BatchHouseOpsView';
import BusinessDetailLayout from '@/pages/dashboard/directory/BusinessDetailLayout';
import BusinessOverview from '@/pages/dashboard/directory/BusinessOverview';
import BusinessExpensesView from '@/pages/dashboard/directory/BusinessExpensesView';
import BusinessSalesView from '@/pages/dashboard/directory/BusinessSalesView';
import BusinessFeedOrdersView from '@/pages/dashboard/directory/BusinessFeedOrdersView';
import BusinessSourcesView from '@/pages/dashboard/directory/BusinessSourcesView';
import AccountingSalesPage from '@/pages/dashboard/accounting/AccountingSalesPage';
import AccountingExpensesPage from '@/pages/dashboard/accounting/AccountingExpensesPage';
import { Toaster } from '@/components/ui/toaster';

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

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function PlaceholderPage({ title }) {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-muted-foreground">{title} — Coming soon</p>
    </div>
  );
}

export default function App() {
  const { checkAuth } = useAuthStore();
  const { initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();
    checkAuth();
  }, [checkAuth, initTheme]);

  return (
    <>
      <Routes>
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

        {/* Protected dashboard routes */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/batches" element={<BatchesPage />} />
          <Route path="/dashboard/batches/:id" element={<BatchDetailLayout />}>
            <Route index element={<BatchOverview />} />
            <Route path="expenses" element={<BatchExpensesView />} />
            <Route path="expenses/:eid" element={<BatchExpensesView />} />
            <Route path="sources" element={<BatchSourcesView />} />
            <Route path="sources/:sid" element={<BatchSourcesView />} />
            <Route path="feed-orders" element={<BatchFeedOrdersView />} />
            <Route path="feed-orders/:fid" element={<BatchFeedOrdersView />} />
            <Route path="sales" element={<BatchSalesView />} />
            <Route path="sales/:saleId" element={<BatchSalesView />} />
            <Route path="performance" element={<BatchOperationsView />} />
            <Route path="performance/:houseId" element={<BatchHouseOpsView />} />
            <Route path="performance/:houseId/:logId" element={<BatchHouseOpsView />} />
          </Route>

          <Route path="/dashboard/farms" element={<Navigate to="/dashboard/directory/farms" replace />} />
          <Route path="/dashboard/workers" element={<Navigate to="/dashboard/directory/workers" replace />} />
          <Route path="/dashboard/health" element={<PlaceholderPage title="Health & Medicine" />} />

          {/* Directory */}
          <Route path="/dashboard/directory" element={<PlaceholderPage title="Directory" />} />
          <Route path="/dashboard/directory/contacts" element={<ContactsPage />} />
          <Route path="/dashboard/directory/businesses" element={<BusinessesPage />} />
          <Route path="/dashboard/directory/businesses/:id" element={<BusinessDetailLayout />}>
            <Route index element={<BusinessOverview />} />
            <Route path="expenses" element={<BusinessExpensesView />} />
            <Route path="expenses/:eid" element={<BusinessExpensesView />} />
            <Route path="sales" element={<BusinessSalesView />} />
            <Route path="sales/:saleId" element={<BusinessSalesView />} />
            <Route path="feed-orders" element={<BusinessFeedOrdersView />} />
            <Route path="feed-orders/:fid" element={<BusinessFeedOrdersView />} />
            <Route path="sources" element={<BusinessSourcesView />} />
            <Route path="sources/:sid" element={<BusinessSourcesView />} />
          </Route>
          <Route path="/dashboard/directory/workers" element={<WorkersPage />} />
          <Route path="/dashboard/directory/farms" element={<FarmsPage />} />
          <Route path="/dashboard/directory/feed" element={<FeedCataloguePage />} />

          {/* Accounting */}
          <Route path="/dashboard/accounting" element={<PlaceholderPage title="Accounting" />} />
          <Route path="/dashboard/accounting/sales" element={<AccountingSalesPage />} />
          <Route path="/dashboard/accounting/sales/:saleId" element={<AccountingSalesPage />} />
          <Route path="/dashboard/accounting/invoices" element={<PlaceholderPage title="Invoices" />} />
          <Route path="/dashboard/accounting/expenses" element={<AccountingExpensesPage />} />
          <Route path="/dashboard/accounting/expenses/:eid" element={<AccountingExpensesPage />} />

          {/* Legacy redirects */}
          <Route path="/dashboard/sales" element={<Navigate to="/dashboard/accounting/sales" replace />} />
          <Route path="/dashboard/invoices" element={<Navigate to="/dashboard/accounting/invoices" replace />} />

          <Route path="/dashboard/settings" element={<SettingsPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}
