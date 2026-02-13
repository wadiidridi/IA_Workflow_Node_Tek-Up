import { Navigate } from 'react-router';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
