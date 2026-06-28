import { useEffect, useState, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { database, getAllRecords } from '@/services/firebase';
import * as XLSX from 'xlsx';
import { Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Employee {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  officeType?: string;
  status?: string;
  pfApplicable?: boolean;
  esiApplicable?: boolean;
  includePF?: boolean;
  includeESI?: boolean;
  salary?: {
    basic?: number;
    hra?: number;
    conveyance?: number;
    otherAllowance?: number;
    specialAllowance?: number;
    additionalSpecialAllowance?: number;
    grossMonthly?: number;
  };
  bankDetails?: { bankAccountNo?: string; panNumber?: string };
  bankAccountNo?: string;
}

interface Holiday {
  date: string;
  name: string;
  departments: string[];
}

interface SalaryRow {
  slNo: number;
  employeeId: string;
  name: string;
  department: string;
  totalDays: number;
  presentDays: number;
  halfDays: number;
  leaveDays: number;
  absentDays: number;
  holidayDays: number;
  perDayRate: number;
  grossMonthly: number;
  presentPay: number;
  halfDayPay: number;
  holidayPay: number;
  totalEarnings: number;
  pfDeduction: number;
  esiDeduction: number;
  netPayable: number;
  bankAccount: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getGross = (emp: Employee): number => {
  if (emp.salary?.grossMonthly && emp.salary.grossMonthly > 0) return emp.salary.grossMonthly;
  if (emp.salary) {
    const s = emp.salary as any;
    const total = (s.basic || 0) + (s.hra || 0) + (s.conveyance || 0) +
      (s.otherAllowance || 0) + (s.specialAllowance || 0) + (s.additionalSpecialAllowance || 0);
    if (total > 0) return total;
  }
  return 0;
};

const isPF = (e: Employee) => e.pfApplicable === true || e.includePF === true;
const isESI = (e: Employee) => e.esiApplicable === true || e.includeESI === true;

const inr = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Component ────────────────────────────────────────────────────────────────
export default function SalaryReport() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [deptFilter, setDeptFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [holidays, setHolidays] = useState<Record<string, Holiday[]>>({});
  const [rows, setRows] = useState<SalaryRow[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Load employees ────────────────────────────────────────────────────────
  useEffect(() => {
    getAllRecords('hr/employees').then((data: any) => {
      const list: Employee[] = Object.values(data || {});
      setEmployees(list.filter(e => e.status !== 'inactive'));
    });
  }, []);

  // ── Load holidays ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onValue(ref(database, 'hr/holidays'), snap => {
      setHolidays(snap.val() || {});
    });
    return () => unsub();
  }, []);

  // ── Build salary rows when month / employees change ───────────────────────
  useEffect(() => {
    if (!selectedMonth || employees.length === 0) return;
    setLoading(true);

    const [y, m] = selectedMonth.split('-').map(Number);
    const totalDays = new Date(y, m, 0).getDate();
    const monthPrefix = `${selectedMonth}-`;

    const attendanceRef = ref(database, 'hr/attendance');
    const unsub = onValue(attendanceRef, snap => {
      const allAtt = snap.val() || {};

      // collect attendance records for this month
      // monthRecs[empId][date] = status — allows dedup when admin + portal both have records
      const monthRecs: Record<string, Record<string, string>> = {};
      Object.keys(allAtt).forEach(date => {
        if (!date.startsWith(monthPrefix)) return;
        const dayMap = allAtt[date];
        Object.values(dayMap || {}).forEach((rec: any) => {
          if (!rec.employeeId) return;
          if (!monthRecs[rec.employeeId]) monthRecs[rec.employeeId] = {};
          monthRecs[rec.employeeId][date] = rec.status;
        });
      });

      // holidays for this month (applicable to each employee)
      const monthHolidays: Holiday[] = Object.values(holidays[selectedMonth] || {});

      const built: SalaryRow[] = employees.map((emp, idx) => {
        // Merge admin marks (keyed by emp.id) and portal check-ins (keyed by emp.employeeId)
        // Spread admin first, portal second — portal record wins on same date (has sessions)
        const merged: Record<string, string> = {
          ...(monthRecs[emp.id] || {}),
          ...(monthRecs[emp.employeeId] || {}),
        };
        let present = 0, half = 0, leave = 0, absent = 0;
        Object.values(merged).forEach(status => {
          if (status === 'Present') present++;
          else if (status === 'Half Day') half++;
          else if (status === 'Leave') leave++;
          else if (status === 'Absent') absent++;
        });

        const holidayDays = monthHolidays.filter(h =>
          h.departments.includes('All') || h.departments.includes(emp.department)
        ).length;

        const gross = getGross(emp);
        const perDay = gross > 0 ? gross / totalDays : 0;

        const presentPay   = present * perDay;
        const halfDayPay   = half * (perDay / 2);
        const holidayPay   = holidayDays * perDay;
        const totalEarnings = presentPay + halfDayPay + holidayPay;

        // PF: 12% of basic+conveyance (pro-rated); approximate as 12% of (basic ratio)
        const salBreak = emp.salary as any || {};
        const basicRatio = gross > 0 ? ((salBreak.basic || 0) + (salBreak.conveyance || 0)) / gross : 0;
        const pfBase = totalEarnings * basicRatio;
        const pf = isPF(emp) ? Math.round(pfBase * 0.12 * 100) / 100 : 0;
        const esi = isESI(emp) && gross <= 21000 ? Math.round(totalEarnings * 0.0075 * 100) / 100 : 0;

        return {
          slNo: idx + 1,
          employeeId: emp.employeeId || emp.id,
          name: emp.name?.trim() || '-',
          department: emp.department || '-',
          totalDays,
          presentDays: present,
          halfDays: half,
          leaveDays: leave,
          absentDays: absent,
          holidayDays,
          perDayRate: Math.round(perDay * 100) / 100,
          grossMonthly: gross,
          presentPay:   Math.round(presentPay * 100) / 100,
          halfDayPay:   Math.round(halfDayPay * 100) / 100,
          holidayPay:   Math.round(holidayPay * 100) / 100,
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          pfDeduction: pf,
          esiDeduction: esi,
          netPayable: Math.round((totalEarnings - pf - esi) * 100) / 100,
          bankAccount: emp.bankDetails?.bankAccountNo || emp.bankAccountNo || '-',
        };
      });

      setRows(built.sort((a, b) => a.employeeId.localeCompare(b.employeeId)));
      setLoading(false);
    }, { onlyOnce: true });

    return () => unsub();
  }, [selectedMonth, employees, holidays]);

  // ── Departments list ──────────────────────────────────────────────────────
  const departments = useMemo(() => {
    const d = [...new Set(employees.map(e => e.department).filter(Boolean))].sort();
    return ['All', ...d];
  }, [employees]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => rows.filter(r => {
    const matchDept = deptFilter === 'All' || r.department === deptFilter;
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeId.toLowerCase().includes(search.toLowerCase());
    return matchDept && matchSearch;
  }), [rows, deptFilter, search]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => filtered.reduce((acc, r) => ({
    presentDays:   acc.presentDays   + r.presentDays,
    halfDays:      acc.halfDays      + r.halfDays,
    grossMonthly:  acc.grossMonthly  + r.grossMonthly,
    totalEarnings: acc.totalEarnings + r.totalEarnings,
    pfDeduction:   acc.pfDeduction   + r.pfDeduction,
    esiDeduction:  acc.esiDeduction  + r.esiDeduction,
    netPayable:    acc.netPayable    + r.netPayable,
  }), { presentDays: 0, halfDays: 0, grossMonthly: 0, totalEarnings: 0, pfDeduction: 0, esiDeduction: 0, netPayable: 0 }), [filtered]);

  // ── Month label ───────────────────────────────────────────────────────────
  const monthLabel = new Date(`${selectedMonth}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // ── Excel export ──────────────────────────────────────────────────────────
  const buildSheet = (sheetRows: SalaryRow[], deptLabel: string) => {
    const headers = [
      'Sl.No', 'Emp ID', 'Employee Name', 'Department',
      'Month Days', 'Present Days', 'Half Days', 'Leave Days', 'Absent Days', 'Holiday Days',
      'Gross Monthly (₹)', 'Per Day Rate (₹)',
      'Present Pay (₹)', 'Half Day Pay (₹)', 'Holiday Pay (₹)', 'Total Earnings (₹)',
      'PF Deduction (₹)', 'ESI Deduction (₹)',
      'Net Payable (₹)', 'Bank Account',
    ];

    const data = sheetRows.map((r, i) => [
      i + 1, r.employeeId, r.name, r.department,
      r.totalDays, r.presentDays, r.halfDays, r.leaveDays, r.absentDays, r.holidayDays,
      r.grossMonthly, r.perDayRate,
      r.presentPay, r.halfDayPay, r.holidayPay, r.totalEarnings,
      r.pfDeduction, r.esiDeduction,
      r.netPayable, r.bankAccount,
    ]);

    const sum = (key: keyof SalaryRow) =>
      Math.round(sheetRows.reduce((s, r) => s + (r[key] as number), 0) * 100) / 100;

    const totalsRow = [
      `TOTAL (${sheetRows.length})`, '', '', '',
      '', sum('presentDays'), sum('halfDays'), '', '', '',
      sum('grossMonthly'), '',
      '', '', '', sum('totalEarnings'),
      sum('pfDeduction'), sum('esiDeduction'),
      sum('netPayable'), '',
    ];

    const title = [
      ['TEXWAVE INDUSTRIES'],
      [`SALARY STATEMENT — ${monthLabel.toUpperCase()}`],
      [`Department: ${deptLabel}`],
      [],
    ];

    const aoa = [...title, headers, ...data, [], totalsRow];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [6, 10, 24, 16, 10, 12, 10, 10, 10, 12, 16, 14, 14, 14, 12, 16, 14, 14, 14, 20].map(w => ({ wch: w }));
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 19 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 19 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 19 } },
    ];
    return ws;
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: All employees
    XLSX.utils.book_append_sheet(wb, buildSheet(rows, 'All Departments'), 'All');

    // One sheet per department
    const depts = [...new Set(rows.map(r => r.department))].sort();
    depts.forEach(dept => {
      const deptRows = rows.filter(r => r.department === dept);
      // Sheet name max 31 chars, strip special chars
      const sheetName = dept.replace(/[:\\/?*[\]]/g, '').slice(0, 31);
      XLSX.utils.book_append_sheet(wb, buildSheet(deptRows, dept), sheetName);
    });

    XLSX.writeFile(wb, `SalaryReport_${selectedMonth}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Monthly Salary Report</h2>
          <p className="text-sm text-muted-foreground">Salary calculation based on present days for {monthLabel}</p>
        </div>
        <Button onClick={exportExcel} disabled={filtered.length === 0} className="gap-2">
          <Download className="h-4 w-4" /> Export Excel
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="h-9 w-44 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search employee..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 pl-8 text-sm w-52"
          />
        </div>
        {!loading && (
          <span className="text-sm text-muted-foreground self-center">{filtered.length} employees</span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Gross',    val: `₹${inr(totals.grossMonthly)}`,  color: 'text-foreground' },
          { label: 'Total Earnings', val: `₹${inr(totals.totalEarnings)}`, color: 'text-green-700' },
          { label: 'Total Deductions (PF+ESI)', val: `₹${inr(totals.pfDeduction + totals.esiDeduction)}`, color: 'text-red-600' },
          { label: 'Net Payable',    val: `₹${inr(totals.netPayable)}`,    color: 'text-blue-700' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Calculating salaries...
        </div>
      ) : (
        <div className="bg-white border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                {['#', 'Emp ID', 'Name', 'Dept', 'Days', 'Present', 'Half', 'Leave', 'Absent', 'Holiday',
                  'Gross/Mo', 'Per Day', 'Present Pay', 'HD Pay', 'Holiday Pay', 'Total Earn', 'PF', 'ESI', 'Net Pay', 'Bank Ac'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={20} className="text-center py-16 text-muted-foreground">
                    No data found
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={r.employeeId} className={`border-b border-border/50 hover:bg-gray-50/50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                    <td className="px-3 py-2 text-muted-foreground">{r.slNo}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.employeeId}</td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{r.name}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px] py-0">{r.department}</Badge>
                    </td>
                    <td className="px-3 py-2 text-center">{r.totalDays}</td>
                    <td className="px-3 py-2 text-center font-semibold text-green-700">{r.presentDays}</td>
                    <td className="px-3 py-2 text-center text-amber-600">{r.halfDays}</td>
                    <td className="px-3 py-2 text-center text-purple-600">{r.leaveDays}</td>
                    <td className="px-3 py-2 text-center text-red-600">{r.absentDays}</td>
                    <td className="px-3 py-2 text-center text-blue-600">{r.holidayDays}</td>
                    <td className="px-3 py-2 text-right">₹{inr(r.grossMonthly)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">₹{inr(r.perDayRate)}</td>
                    <td className="px-3 py-2 text-right text-green-700">₹{inr(r.presentPay)}</td>
                    <td className="px-3 py-2 text-right text-amber-600">₹{inr(r.halfDayPay)}</td>
                    <td className="px-3 py-2 text-right text-blue-600">₹{inr(r.holidayPay)}</td>
                    <td className="px-3 py-2 text-right font-semibold">₹{inr(r.totalEarnings)}</td>
                    <td className="px-3 py-2 text-right text-red-600">₹{inr(r.pfDeduction)}</td>
                    <td className="px-3 py-2 text-right text-red-600">₹{inr(r.esiDeduction)}</td>
                    <td className="px-3 py-2 text-right font-bold text-blue-700">₹{inr(r.netPayable)}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.bankAccount}</td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-border font-semibold">
                  <td colSpan={5} className="px-3 py-2.5 text-sm">TOTAL ({filtered.length} employees)</td>
                  <td className="px-3 py-2.5 text-center text-green-700">{totals.presentDays}</td>
                  <td className="px-3 py-2.5 text-center text-amber-600">{totals.halfDays}</td>
                  <td colSpan={3} />
                  <td className="px-3 py-2.5 text-right">₹{inr(totals.grossMonthly)}</td>
                  <td />
                  <td colSpan={3} />
                  <td className="px-3 py-2.5 text-right">₹{inr(totals.totalEarnings)}</td>
                  <td className="px-3 py-2.5 text-right text-red-600">₹{inr(totals.pfDeduction)}</td>
                  <td className="px-3 py-2.5 text-right text-red-600">₹{inr(totals.esiDeduction)}</td>
                  <td className="px-3 py-2.5 text-right text-blue-700">₹{inr(totals.netPayable)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
