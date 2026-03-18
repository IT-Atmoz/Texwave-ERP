import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, onValue, update } from 'firebase/database';
import { Bell } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: number;
}

const typeColors: Record<string, string> = {
  expense: 'bg-green-500',
  leave:   'bg-blue-500',
  ticket:  'bg-amber-500',
  exit:    'bg-red-500',
  hr:      'bg-purple-500',
  salary:  'bg-indigo-500',
  task:    'bg-cyan-500',
};

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Admin/HR read from adminFeed, employees from their own key
  const isAdminOrHR = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';
  const feedPath = isAdminOrHR
    ? 'notifications/adminFeed'
    : `notifications/${user?.firebaseKey || user?.employeeId || ''}`;

  useEffect(() => {
    if (!user) return;
    const unsub = onValue(ref(database, feedPath), snap => {
      if (!snap.exists()) { setNotifications([]); return; }
      const data = snap.val();
      const list: Notification[] = Object.entries(data)
        .map(([id, v]: any) => ({ ...v, id }))
        .sort((a: any, b: any) => b.createdAt - a.createdAt)
        .slice(0, 30);
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
    if (Object.keys(updates).length > 0) {
      await update(ref(database), updates);
    }
  };

  const markRead = async (id: string) => {
    await update(ref(database, `${feedPath}/${id}`), { read: true });
  };

  if (!user) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="relative h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
        onClick={() => { setOpen(v => !v); if (!open && unreadCount > 0) markAllRead(); }}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button className="text-xs text-primary hover:underline" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                  onClick={() => markRead(n.id)}
                >
                  <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${typeColors[n.type] || 'bg-gray-400'}`} />
                  <div className="min-w-0">
                    <p className={`text-sm leading-snug ${!n.read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(n.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5 ml-auto" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
