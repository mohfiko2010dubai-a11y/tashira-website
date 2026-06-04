import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { Loader2 } from 'lucide-react';

interface StaffGuardProps {
  children: ReactNode;
}

export default function StaffGuard({ children }: StaffGuardProps) {
  const { isAuthenticated, isLoading } = useStaffAuth();

  // Show loader while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#C9A04C] animate-spin" />
      </div>
    );
  }

  // Only redirect after loading is complete AND not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/staff/login" replace />;
  }

  return <>{children}</>;
}
