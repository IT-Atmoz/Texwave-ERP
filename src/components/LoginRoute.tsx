// src/components/LoginRoute.tsx
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import { ReactNode } from "react";

interface LoginRouteProps {
  children: ReactNode;
}

export function LoginRoute({ children }: LoginRouteProps) {
  const { user } = useAuth();

  // If already logged in → go to appropriate dashboard
  if (user) {
    if (user.role === 'employee') {
      return <Navigate to="/employee/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
