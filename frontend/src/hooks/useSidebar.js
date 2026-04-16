import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import useMediaQuery from '@/hooks/useMediaQuery';
import { STORAGE_KEY } from '@/layouts/sidebar/constants';

// Static list of sidebar group keys the hook knows about for auto-open behavior.
// Individual groups are dynamically built in Sidebar.js via `buildSidebar`; this
// list only needs to reflect the top-level group keys we want to auto-expand
// when the user is on one of their child routes.
const AUTO_OPEN_GROUPS = [
  { key: 'directory', path: '/dashboard/directory' },
  { key: 'accounting', path: '/dashboard/accounting' },
];

export default function useSidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    AUTO_OPEN_GROUPS.forEach((g) => { initial[g.key] = false; });
    return initial;
  });

  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isExpanded = !isDesktop || !collapsed;

  const toggleGroup = useCallback((key) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const closeMobileDrawer = useCallback(() => {
    if (!isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch {}
  }, [collapsed]);

  useEffect(() => {
    AUTO_OPEN_GROUPS.forEach((g) => {
      if (location.pathname.startsWith(g.path)) {
        setOpenGroups((prev) => (prev[g.key] ? prev : { ...prev, [g.key]: true }));
      }
    });
  }, [location.pathname]);

  useEffect(() => {
    if (!isDesktop && sidebarOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [sidebarOpen, isDesktop]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [sidebarOpen]);

  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  return {
    sidebarOpen, setSidebarOpen,
    collapsed, setCollapsed,
    isDesktop, isExpanded,
    openGroups, toggleGroup,
    closeMobileDrawer,
  };
}
