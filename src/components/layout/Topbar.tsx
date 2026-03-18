import { useAuth } from '@/context/AuthContext';
import { LiveClock } from './LiveClock';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { NotificationBell } from '@/components/NotificationBell';

export const Topbar = () => {
  const { user } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header className="h-12 bg-card/80 backdrop-blur-md border-b border-border/60 px-3 md:px-5 flex items-center gap-2 md:gap-3 sticky top-0 z-20 shadow-sm shrink-0">

      {/* Search */}
      <div className={`relative flex-1 max-w-xs transition-all duration-200 ease-smooth ${searchFocused ? 'max-w-sm' : ''}`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
        <input
          type="text"
          placeholder="Search..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className={`
            w-full h-8 pl-8 pr-3 rounded-lg text-xs
            bg-muted/50 border border-border/50
            placeholder:text-muted-foreground/40
            transition-all duration-200 ease-smooth
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 focus:bg-background
            hover:border-primary/20
          `}
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* Clock */}
        <div className="hidden sm:block text-xs text-muted-foreground/70 font-medium tabular-nums">
          <LiveClock />
        </div>

        {/* Notification bell */}
        <NotificationBell />

        {/* User chip */}
        {user && (
          <div className="flex items-center gap-2 pl-3 border-l border-border/60">
            <div className="h-7 w-7 rounded-full bg-gradient-primary flex items-center justify-center shadow-sm">
              <span className="text-[10px] font-bold text-white">
                {(user.name || user.username || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
              </span>
            </div>
            <div className="hidden sm:block leading-none">
              <p className="text-xs font-semibold text-foreground">{user.name || user.username}</p>
              <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{user.role}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
