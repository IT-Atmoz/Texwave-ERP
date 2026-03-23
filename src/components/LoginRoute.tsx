// src/components/LoginRoute.tsx
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import { ReactNode, useState, useEffect } from "react";
import { LoginLoader } from "./LoginLoader";

interface LoginRouteProps {
  children: ReactNode;
}

export function LoginRoute({ children }: LoginRouteProps) {
  const { user } = useAuth();
  const [showLoader, setShowLoader] = useState(false);
  const [redirect, setRedirect] = useState(false);

  useEffect(() => {
    if (user) {
      // Check if this is a fresh login (not a page refresh)
      const justLoggedIn = sessionStorage.getItem('justLoggedIn');
      if (justLoggedIn) {
        sessionStorage.removeItem('justLoggedIn');
        setShowLoader(true);
      } else {
        setRedirect(true);
      }
    }
  }, [user]);

  if (redirect && user) {
    if (user.role === 'employee') return <Navigate to="/employee/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  if (showLoader && user) {
    return (
      <LoginLoader
        userName={user.name || user.username || 'User'}
        onDone={() => {
          setShowLoader(false);
          setRedirect(true);
        }}
      />
    );
  }

  return <>{children}</>;
}
