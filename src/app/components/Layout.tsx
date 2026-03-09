import { Outlet } from 'react-router';
import { ProtectedRoute } from './ProtectedRoute';

/**
 * Root layout for all authenticated routes.
 * Wraps children in ProtectedRoute to enforce authentication.
 */
export function AuthLayout() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  );
}
