import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AccessDenied from '@/pages/AccessDenied';

interface ProtectedRouteProps {
  children: React.ReactNode;
  module?: string;
}

export const ProtectedRoute = ({ children, module }: ProtectedRouteProps) => {
  const { user, hasAccess } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Employee users accessing admin modules → redirect to employee portal
  if (user.role === 'employee') {
    return <Navigate to="/employee/dashboard" replace />;
  }

  if (module && !hasAccess(module)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
};

export const EmployeeProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'employee') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
