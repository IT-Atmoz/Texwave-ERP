import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Info } from 'lucide-react';
import { database } from '@/services/firebase';
import { ref, set, get } from 'firebase/database';

const ALL_ROLES = ['admin', 'hr', 'accountant', 'sales', 'manager', 'employee'];
const ALL_MODULES = [
  'dashboard', 'contacts', 'sales', 'purchases', 'expenses',
  'banking', 'accounting', 'hr', 'master', 'settings', 'reports',
];

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: ['dashboard', 'contacts', 'sales', 'purchases', 'expenses', 'banking', 'accounting', 'hr', 'master', 'settings', 'reports'],
  sales: ['dashboard', 'contacts', 'sales', 'expenses'],
  hr: ['dashboard', 'hr'],
  accountant: ['dashboard', 'contacts', 'purchases', 'expenses', 'banking', 'accounting', 'sales'],
  manager: ['dashboard', 'contacts', 'sales', 'purchases', 'expenses', 'hr'],
  employee: [],
};

export default function PrivilegeManager() {
  const { privileges, updatePrivileges } = useAuth();

  // Seed defaults if not present
  useEffect(() => {
    const seedIfEmpty = async () => {
      const snap = await get(ref(database, 'settings/privileges'));
      if (!snap.exists()) {
        await set(ref(database, 'settings/privileges'), DEFAULT_PERMISSIONS);
      }
    };
    seedIfEmpty();
  }, []);

  const handleToggle = async (role: string, module: string, checked: boolean) => {
    const current = privileges[role] ?? DEFAULT_PERMISSIONS[role] ?? [];
    const updated = checked
      ? [...current, module]
      : current.filter((m) => m !== module);
    await updatePrivileges(role, updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Privilege Manager</h2>
            <p className="text-muted-foreground text-sm">Manage role-based module access</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Info className="h-4 w-4 shrink-0" />
          Changes take effect immediately for active sessions
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module Access by Role</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground w-36">Module</th>
                  {ALL_ROLES.map((role) => (
                    <th key={role} className="text-center py-3 px-4 font-semibold">
                      <Badge variant={role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                        {role}
                      </Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_MODULES.map((module) => (
                  <tr key={module} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium capitalize">{module}</td>
                    {ALL_ROLES.map((role) => {
                      const hasModule = (privileges[role] ?? DEFAULT_PERMISSIONS[role] ?? []).includes(module);
                      const isAdminLocked = role === 'admin';
                      return (
                        <td key={role} className="py-3 px-4 text-center">
                          <Switch
                            checked={hasModule}
                            disabled={isAdminLocked}
                            onCheckedChange={(checked) => handleToggle(role, module, checked)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
