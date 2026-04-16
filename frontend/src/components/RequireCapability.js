import { Navigate } from 'react-router-dom';
import useCapabilities from '@/hooks/useCapabilities';

/**
 * Guards a child element behind a capability check. When the current user
 * cannot satisfy `action`, redirects to `fallback` (default: /dashboard).
 *
 * Usage:
 *   <Route path="/dashboard/batches" element={
 *     <RequireCapability action="batch:read">
 *       <BatchesPage />
 *     </RequireCapability>
 *   } />
 */
export default function RequireCapability({ action, fallback = '/dashboard', children }) {
  const { can } = useCapabilities();
  if (!action) return children;
  return can(action) ? children : <Navigate to={fallback} replace />;
}
