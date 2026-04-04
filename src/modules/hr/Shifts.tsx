import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ref, onValue, set } from 'firebase/database';
import { database } from '@/services/firebase';
import { getAllRecords } from '@/services/firebase';
import { Building2, Wifi } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  employeeId: string;
  department?: string;
}

type Privilege = 'office' | 'remote';

export default function LocationPrivilege() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [privileges, setPrivileges] = useState<Record<string, Privilege>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Load employees
  useEffect(() => {
    getAllRecords('hr/employees').then((data: any[]) => {
      setEmployees((data || []).filter(e => e.status !== 'inactive'));
    });
  }, []);

  // Listen to privileges in real-time
  useEffect(() => {
    const privRef = ref(database, 'hr/locationPrivilege');
    const unsub = onValue(privRef, (snap) => {
      setPrivileges((snap.val() as Record<string, Privilege>) || {});
    });
    return () => unsub();
  }, []);

  const handleToggle = async (emp: Employee, value: Privilege) => {
    setSaving(emp.id);
    try {
      await set(ref(database, `hr/locationPrivilege/${emp.id}`), value);
      toast({ title: `${emp.name} set to ${value === 'office' ? 'Office (Desktop only)' : 'Remote (Mobile allowed)'}` });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const getPrivilege = (empId: string): Privilege => privileges[empId] || 'office';

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Location Privilege</h1>
        <p className="text-muted-foreground mt-1">
          Control where each employee can access the portal — Office (desktop only) or Remote (mobile allowed)
        </p>
      </div>

      {/* Legend */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
          <Building2 className="h-4 w-4 text-blue-600" />
          <div>
            <p className="text-xs font-semibold text-blue-700">Office</p>
            <p className="text-[11px] text-blue-500">Desktop access only</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg">
          <Wifi className="h-4 w-4 text-green-600" />
          <div>
            <p className="text-xs font-semibold text-green-700">Remote</p>
            <p className="text-[11px] text-green-500">Mobile access allowed</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Employee Access Control</h3>
        </CardHeader>
        <CardContent className="p-0">
          {employees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No employees found</div>
          ) : (
            <div className="divide-y divide-border">
              {employees.map(emp => {
                const current = getPrivilege(emp.id);
                const isSavingThis = saving === emp.id;
                return (
                  <div key={emp.id} className="flex items-center justify-between px-5 py-3.5">
                    {/* Employee info */}
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{emp.name}</p>
                        <p className="text-[11px] text-muted-foreground">{emp.employeeId}{emp.department ? ` · ${emp.department}` : ''}</p>
                      </div>
                    </div>

                    {/* Toggle */}
                    <div className="flex items-center gap-2">
                      {isSavingThis && (
                        <span className="h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                      )}
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                        <button
                          onClick={() => handleToggle(emp, 'office')}
                          disabled={isSavingThis}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                            current === 'office'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          <Building2 className="h-3.5 w-3.5" />
                          Office
                        </button>
                        <button
                          onClick={() => handleToggle(emp, 'remote')}
                          disabled={isSavingThis}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-l border-gray-200 transition-colors ${
                            current === 'remote'
                              ? 'bg-green-600 text-white'
                              : 'bg-white text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          <Wifi className="h-3.5 w-3.5" />
                          Remote
                        </button>
                      </div>
                      <Badge className={current === 'office'
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-green-100 text-green-700 border-green-200'
                      }>
                        {current === 'office' ? 'Desktop only' : 'Mobile allowed'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
