import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, onValue, update } from 'firebase/database';
import { Bell, Receipt, TicketCheck, ClipboardList, FileText, IndianRupee, DoorOpen, Star } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: number;
}

const typeConfig: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  expense: { color: 'text-green-600',  bg: 'bg-green-100',  icon: Receipt,       label: 'Expense' },
  leave:   { color: 'text-blue-600',   bg: 'bg-blue-100',   icon: FileText,      label: 'Leave' },
  ticket:  { color: 'text-amber-600',  bg: 'bg-amber-100',  icon: TicketCheck,   label: 'Ticket' },
  exit:    { color: 'text-red-600',    bg: 'bg-red-100',    icon: DoorOpen,      label: 'Exit' },
  hr:      { color: 'text-purple-600', bg: 'bg-purple-100', icon: Star,          label: 'HR' },
  salary:  { color: 'text-indigo-600', bg: 'bg-indigo-100', icon: IndianRupee,   label: 'Salary' },
  task:    { color: 'text-cyan-600',   bg: 'bg-cyan-100',   icon: ClipboardList, label: 'Task' },
};

const dotColors: Record<string, string> = {
  expense: 'bg-green-500',
  leave:   'bg-blue-500',
  ticket:  'bg-amber-500',
  exit:    'bg-red-500',
  hr:      'bg-purple-500',
  salary:  'bg-indigo-500',
  task:    'bg-cyan-500',
};

// Roles that read from adminFeed (all non-employee portal users)
const ADMIN_ROLES = ['admin', 'hr', 'manager', 'sales', 'accountant', 'quality', 'production'];

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAdminRole = ADMIN_ROLES.includes(user?.role || '');
  // Admin-role users read from adminFeed; employees read from their own key
  const feedPath = isAdminRole
    ? 'notifications/adminFeed'
    : `notifications/${user?.firebaseKey || user?.employeeId || 'unknown'}`;

  useEffect(() => {
    if (!user) return;
    const unsub = onValue(ref(database, feedPath), snap => {
      if (!snap.exists()) { setNotifications([]); return; }
      const list: Notification[] = Object.entries(snap.val())
        .map(([id, v]: any) => ({ ...v, id }))
        .sort((a: any, b: any) => b.createdAt - a.createdAt)
        .slice(0, 40);
      setNotifications(list);
    });
    return () => unsub();
  }, [feedPath, user]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    const updates: Record<string, boolean> = {};
    notifications.forEach(n => {
      if (!n.read) updates[`${feedPath}/${n.id}/read`] = true;
    });
    if (Object.keys(updates).length > 0) await update(ref(database), updates);
  };

  const markRead = async (id: string) => {
    await update(ref(database, `${feedPath}/${id}`), { read: true });
  };

  const handleOpen = () => {
    setOpen(v => !v);
    if (!open && unreadCount > 0) markAllRead();
  };

  if (!user) return null;

  // Group by type for filter tabs
  const types = [...new Set(notifications.map(n => n.type))];

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell button */}
      <button
        className="relative h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
        onClick={handleOpen}
        title="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4.5 w-4.5 min-w-[18px] rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold shadow-sm px-0.5">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="fixed right-4 top-14 w-96 bg-card border border-border rounded-2xl shadow-2xl z-[9999] overflow-hidden flex flex-col max-h-[520px]">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Notifications</p>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button className="text-xs text-primary hover:underline font-medium" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          {/* Type pills */}
          {types.length > 1 && (
            <div className="flex gap-1.5 px-3 py-2 border-b border-border overflow-x-auto shrink-0 bg-muted/10">
              {types.map(type => {
                const cfg = typeConfig[type] || { bg: 'bg-gray-100', color: 'text-gray-600', label: type };
                const unreadOfType = notifications.filter(n => n.type === type && !n.read).length;
                return (
                  <span key={type} className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                    {unreadOfType > 0 && (
                      <span className="bg-white/70 text-current text-[9px] font-bold px-1 rounded-full">{unreadOfType}</span>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {/* Notifications list */}
          <div className="overflow-y-auto flex-1 divide-y divide-border/50">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No notifications yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">You're all caught up!</p>
              </div>
            ) : (
              notifications.map(n => {
                const cfg = typeConfig[n.type] || { bg: 'bg-gray-100', color: 'text-gray-600', icon: Bell, label: n.type };
                const Icon = cfg.icon;
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                    onClick={() => markRead(n.id)}
                  >
                    {/* Type icon */}
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${!n.read ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <div className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${dotColors[n.type] || 'bg-primary'}`} />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                          {new Date(n.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border bg-muted/20 text-center shrink-0">
              <p className="text-xs text-muted-foreground">{notifications.length} notifications · Showing latest 40</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
