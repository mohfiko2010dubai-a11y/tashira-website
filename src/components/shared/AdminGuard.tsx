import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface AdminGuardProps {
  children: ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#C9A04C] animate-spin" />
      </div>
    );
  }

  // For now, allow any logged-in user to access dashboard
  // In production, check for admin role
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
