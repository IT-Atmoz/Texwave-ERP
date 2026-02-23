import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '@/types';
import { database } from '@/services/firebase';
import { ref, get, set, onValue } from 'firebase/database';

interface AuthContextType {
  user: User | null;
  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasAccess: (module: string) => boolean;
  privileges: Record<string, string[]>;
  updatePrivileges: (role: string, modules: string[]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Static user database for demo
const USERS: Record<string, { password: string; role: UserRole; name: string }> = {
  'admin': { password: 'admin123', role: 'admin', name: 'Admin User' },
  'sales': { password: 'sales123', role: 'sales', name: 'Sales Executive' },
  'hr': { password: 'hr123', role: 'hr', name: 'HR Manager' },
  'accounts': { password: 'accounts123', role: 'accountant', name: 'Accountant User' },
  'manager': { password: 'manager123', role: 'manager', name: 'Manager User' },
  'quality': { password: 'quality123', role: 'quality', name: 'Quality User' },
  'production': { password: 'prod123', role: 'production', name: 'Production User' },
};

// Role-based access control (fallback defaults)
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['dashboard', 'contacts', 'sales', 'purchases', 'expenses', 'banking', 'accounting', 'hr', 'master', 'settings', 'reports'],
  sales: ['dashboard', 'contacts', 'sales', 'expenses'],
  hr: ['dashboard', 'hr'],
  accountant: ['dashboard', 'contacts', 'purchases', 'expenses', 'banking', 'accounting', 'sales'],
  manager: ['dashboard', 'contacts', 'sales', 'purchases', 'expenses', 'hr'],
  quality: ['dashboard'],
  production: ['dashboard'],
  employee: [],
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [privileges, setPrivileges] = useState<Record<string, string[]>>(ROLE_PERMISSIONS);

  useEffect(() => {
    const savedUser = localStorage.getItem('erp_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Listen to Firebase privileges in real-time
  useEffect(() => {
    const privRef = ref(database, 'settings/privileges');
    const unsub = onValue(privRef, (snap) => {
      if (snap.exists()) {
        setPrivileges({ ...ROLE_PERMISSIONS, ...snap.val() });
      } else {
        setPrivileges(ROLE_PERMISSIONS);
      }
    });
    return () => unsub();
  }, []);

  const login = async (identifier: string, password: string): Promise<boolean> => {
    // Step 1: Try static users (existing hardcoded path)
    const userData = USERS[identifier];
    if (userData && userData.password === password) {
      const u: User = { username: identifier, role: userData.role, name: userData.name };
      setUser(u);
      localStorage.setItem('erp_user', JSON.stringify(u));
      return true;
    }

    // Step 2: Query Firebase users/ where email === identifier and password matches
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        for (const key of Object.keys(usersData)) {
          const record = usersData[key];
          if (record.email === identifier && record.password === password) {
            const u: User = {
              username: identifier,
              role: 'employee',
              name: record.name,
              employeeId: record.employeeId,
              email: record.email,
            };
            setUser(u);
            localStorage.setItem('erp_user', JSON.stringify(u));
            return true;
          }
        }
      }
    } catch (err) {
      console.error('Firebase employee login error:', err);
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('erp_user');
  };

  const hasAccess = (module: string): boolean => {
    if (!user) return false;
    const perms = privileges[user.role] ?? ROLE_PERMISSIONS[user.role] ?? [];
    return perms.includes(module.toLowerCase());
  };

  const updatePrivileges = async (role: string, modules: string[]): Promise<void> => {
    await set(ref(database, `settings/privileges/${role}`), modules);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, hasAccess, privileges, updatePrivileges }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
