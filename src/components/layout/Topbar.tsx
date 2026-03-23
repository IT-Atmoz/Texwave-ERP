import { useAuth } from '@/context/AuthContext';
import { LiveClock } from './LiveClock';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { NotificationBell } from '@/components/NotificationBell';

export const Topbar = () => {
  const { user } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);

  const initials = user
    ? (user.name || user.username || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <header
      className="h-12 bg-white border-b border-slate-200/80 px-4 md:px-5 flex items-center gap-3 sticky top-0 z-20 shrink-0"
      style={{ boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.04)' }}
    >
      {/* Search */}
      <div className={`relative transition-all duration-200 ${searchFocused ? 'w-56' : 'w-44'}`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="w-full h-8 pl-8 pr-3 rounded-lg text-[13px] bg-slate-100 border border-transparent
            placeholder:text-slate-400 text-slate-700
            focus:outline-none focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-primary/15
            transition-all duration-200"
        />
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        {/* Clock */}
        <div className="hidden sm:block text-[12px] text-slate-500 font-medium tabular-nums px-1">
          <LiveClock />
        </div>

        {/* Notification bell */}
        <NotificationBell />

        {/* Divider */}
        <div className="h-5 w-px bg-slate-200" />

        {/* User chip */}
        {user && (
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0"
              style={{ background: 'linear-gradient(135deg, hsl(152,76%,30%), hsl(152,70%,44%))' }}
            >
              {initials}
            </div>
            <div className="hidden sm:block leading-none">
              <p className="text-[12px] font-semibold text-slate-800">{user.name || user.username}</p>
              <p className="text-[10px] text-slate-400 capitalize mt-0.5">{user.role}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
