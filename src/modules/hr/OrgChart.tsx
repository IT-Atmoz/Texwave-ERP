import { useEffect, useState } from 'react';
import { getAllRecords } from '@/services/firebase';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChevronRight, ChevronDown, Search, Users, User,
} from 'lucide-react';

interface EmpNode {
  id: string;
  name: string;
  role: string;
  department: string;
  employeeId: string;
  profilePhoto?: string;
  reportingTo?: string;
  status?: string;
  children: EmpNode[];
}

function buildTree(employees: any[]): EmpNode[] {
  const map: Record<string, EmpNode> = {};

  // Build map by name (reportingTo stores names)
  employees.forEach(emp => {
    map[emp.name] = {
      id: emp.id,
      name: emp.name,
      role: emp.role ?? '',
      department: emp.department ?? '',
      employeeId: emp.employeeId ?? '',
      profilePhoto: emp.profilePhoto,
      reportingTo: emp.reportingTo,
      status: emp.status ?? 'active',
      children: [],
    };
  });

  const roots: EmpNode[] = [];

  employees.forEach(emp => {
    const node = map[emp.name];
    const parentName = emp.reportingTo?.trim();
    if (parentName && map[parentName] && parentName !== emp.name) {
      map[parentName].children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

// ── Avatar ──
function Avatar({ emp }: { emp: EmpNode }) {
  const initials = emp.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  if (emp.profilePhoto) {
    return (
      <img
        src={emp.profilePhoto}
        alt={emp.name}
        className="h-8 w-8 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
      />
    );
  }
  return (
    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm shrink-0">
      {initials}
    </div>
  );
}

// ── Tree Node ──
function TreeNode({ node, depth = 0, search }: { node: EmpNode; depth?: number; search: string }) {
  const [open, setOpen] = useState(depth < 2);

  const nameMatch = node.name.toLowerCase().includes(search) ||
    node.role.toLowerCase().includes(search) ||
    node.department.toLowerCase().includes(search);

  // If searching, show only if this node or a descendant matches
  const hasMatchInSubtree = (n: EmpNode): boolean =>
    n.name.toLowerCase().includes(search) ||
    n.role.toLowerCase().includes(search) ||
    n.department.toLowerCase().includes(search) ||
    n.children.some(hasMatchInSubtree);

  if (search && !hasMatchInSubtree(node)) return null;

  const hasChildren = node.children.length > 0;
  const deptColors: Record<string, string> = {
    Staff:   'bg-blue-100 text-blue-700',
    Workers: 'bg-green-100 text-green-700',
    Others:  'bg-purple-100 text-purple-700',
  };
  const deptColor = deptColors[node.department] ?? 'bg-gray-100 text-gray-600';

  return (
    <div className={`${depth > 0 ? 'ml-6 pl-4 border-l-2 border-dashed border-border' : ''}`}>
      {/* Node Card */}
      <div
        className={`group flex items-center gap-3 p-3 rounded-xl mb-2 border transition-all cursor-pointer ${
          nameMatch && search
            ? 'bg-primary/5 border-primary/30 shadow-sm'
            : 'bg-white border-border hover:border-primary/30 hover:shadow-sm'
        }`}
        onClick={() => hasChildren && setOpen(o => !o)}
      >
        {/* Expand toggle */}
        <div className="w-5 shrink-0 flex justify-center">
          {hasChildren ? (
            open
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <div className="h-1.5 w-1.5 rounded-full bg-border mx-auto mt-1" />
          )}
        </div>

        <Avatar emp={node} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{node.name}</span>
            <span className="text-xs text-muted-foreground">{node.employeeId}</span>
            {node.status !== 'active' && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Inactive</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground">{node.role}</span>
            {node.department && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${deptColor}`}>
                {node.department}
              </span>
            )}
            {hasChildren && (
              <span className="text-[10px] text-muted-foreground">
                · {node.children.length} direct report{node.children.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {open && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} depth={depth + 1} search={search} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function OrgChart() {
  const [tree, setTree]       = useState<EmpNode[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    getAllRecords('hr/employees').then(emps => {
      setTotal(emps.length);
      setTree(buildTree(emps));
      setLoading(false);
    });
  }, []);

  const searchLower = search.toLowerCase().trim();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Employee Hierarchy
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Org tree based on Reporting To field &nbsp;·&nbsp; {total} employees
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, role, dept..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><ChevronRight className="h-3.5 w-3.5" /> Click to expand/collapse</span>
        <span className="flex items-center gap-1.5"><div className="h-3 w-3 border-2 border-dashed border-border rounded" /> Reports to parent</span>
        {searchLower && <span className="text-primary font-medium">Showing results for "{search}"</span>}
      </div>

      {/* Tree */}
      <Card>
        <CardContent className="p-5">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
              Loading employees...
            </div>
          ) : tree.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No employees found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {tree.map(node => (
                <TreeNode key={node.id} node={node} depth={0} search={searchLower} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
