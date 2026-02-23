import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  getAllRecords,
  updateRecord,
} from '@/services/firebase';

interface Salary {
  grossMonthly?: number;
  monthlySalary?: number;
}

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  salary?: Salary;
}

export default function Otrate() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [otRates, setOtRates] = useState<Record<string, string>>({});
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const emp = await getAllRecords('hr/employees');
      const ot = await getAllRecords('hr/otRates');

      setEmployees(emp as Employee[]);

      const clean: Record<string, string> = {};
      ot.forEach((r: any) => {
        if (r.otRate !== undefined && r.otRate !== null) {
          clean[r.id] = String(r.otRate);
        }
      });

      setOtRates(clean);
      setLoading(false);
    };

    load();
  }, []);

  const departments = [
    'All',
    ...Array.from(new Set(employees.map(e => e.department))).filter(Boolean),
  ];

  const saveOtRate = async (emp: Employee) => {
    const rateStr = otRates[emp.id];
    if (!rateStr || rateStr.trim() === '') {
      toast({
        title: 'Error',
        description: 'Please enter a valid OT rate',
        variant: 'destructive',
      });
      return;
    }

    const rate = Number(rateStr);
    if (isNaN(rate) || rate < 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid positive number',
        variant: 'destructive',
      });
      return;
    }

    setSavingId(emp.id);

    try {
      await updateRecord('hr/otRates', emp.id, {
        employeeId: emp.employeeId,
        employeeName: emp.name,
        department: emp.department,
        monthlySalary:
          emp.salary?.grossMonthly ||
          emp.salary?.monthlySalary ||
          0,
        otRate: rate,
      });

      toast({
        title: 'Success',
        description: `OT rate updated for ${emp.name}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update OT rate',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading OT Rates…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">OT Rate</h1>

      <select
        value={departmentFilter}
        onChange={e => setDepartmentFilter(e.target.value)}
        className="border px-3 py-2 rounded"
      >
        {departments.map(d => (
          <option key={d}>{d}</option>
        ))}
      </select>

      <Card>
        <CardContent className="p-0">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3">Emp ID</th>
                <th className="p-3">Dept</th>
                <th className="p-3">Salary</th>
                <th className="p-3">OT ₹/hr</th>
                <th className="p-3">Save</th>
              </tr>
            </thead>
            <tbody>
              {employees
                .filter(
                  e =>
                    departmentFilter === 'All' ||
                    e.department === departmentFilter
                )
                .map(emp => (
                  <tr key={emp.id} className="border-b">
                    <td className="p-3">{emp.name}</td>
                    <td className="p-3">{emp.employeeId}</td>
                    <td className="p-3">{emp.department}</td>
                    <td className="p-3 text-right">
                      ₹{(
                        emp.salary?.grossMonthly ||
                        emp.salary?.monthlySalary ||
                        0
                      ).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        value={otRates[emp.id] ?? ''}
                        onChange={e => {
                          const value = e.target.value;
                          setOtRates(prev => ({
                            ...prev,
                            [emp.id]: value,
                          }));
                        }}
                        placeholder="Enter rate"
                        className="w-20 border rounded px-2 py-1 text-center"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        size="sm"
                        onClick={() => saveOtRate(emp)}
                        disabled={savingId === emp.id}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        {savingId === emp.id ? 'Saving...' : 'Save'}
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
