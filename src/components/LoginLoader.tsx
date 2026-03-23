import { useEffect, useState } from 'react';
import {
  LayoutDashboard, ShoppingCart, Users, FileText,
  Receipt, CreditCard, BookOpen, Package, BarChart3, Settings,
} from 'lucide-react';

interface LoginLoaderProps {
  userName: string;
  onDone: () => void;
}

const ERP_MODULES = [
  { icon: LayoutDashboard, label: 'Dashboard',  color: 'hsl(222,70%,60%)' },
  { icon: ShoppingCart,    label: 'Sales',       color: 'hsl(152,70%,44%)' },
  { icon: Users,           label: 'HR',          color: 'hsl(280,65%,58%)' },
  { icon: FileText,        label: 'Quotations',  color: 'hsl(30,90%,55%)'  },
  { icon: Receipt,         label: 'Invoices',    color: 'hsl(152,70%,44%)' },
  { icon: Package,         label: 'Inventory',   color: 'hsl(199,80%,52%)' },
  { icon: CreditCard,      label: 'Banking',     color: 'hsl(340,75%,55%)' },
  { icon: BookOpen,        label: 'Accounting',  color: 'hsl(45,90%,50%)'  },
  { icon: BarChart3,       label: 'Reports',     color: 'hsl(222,70%,60%)' },
  { icon: Settings,        label: 'Settings',    color: 'hsl(210,15%,58%)' },
];

export function LoginLoader({ userName, onDone }: LoginLoaderProps) {
  const [progress, setProgress]         = useState(0);
  const [activeModule, setActiveModule] = useState(0);
  const [loadedModules, setLoadedModules] = useState<number[]>([]);
  const [visible, setVisible]           = useState(false);
  const [exiting, setExiting]           = useState(false);

  useEffect(() => {
    // Fade in
    const t0 = setTimeout(() => setVisible(true), 50);

    // Module reveal sequence
    const moduleTimers: ReturnType<typeof setTimeout>[] = [];
    ERP_MODULES.forEach((_, i) => {
      moduleTimers.push(
        setTimeout(() => {
          setActiveModule(i);
          setLoadedModules(prev => [...prev, i]);
        }, 150 + i * 170)
      );
    });

    // Progress bar (smooth fill over ~2s)
    let p = 0;
    const interval = setInterval(() => {
      p += p < 80 ? 2.2 : p < 95 ? 0.8 : 0.3;
      if (p >= 100) { p = 100; clearInterval(interval); }
      setProgress(p);
    }, 35);

    // Exit
    const exitTimer = setTimeout(() => setExiting(true), 2200);
    const doneTimer = setTimeout(onDone, 2650);

    return () => {
      clearTimeout(t0);
      moduleTimers.forEach(clearTimeout);
      clearInterval(interval);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  const currentModule = ERP_MODULES[activeModule];

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none"
      style={{
        background: 'hsl(215,28%,97%)',
        opacity: exiting ? 0 : visible ? 1 : 0,
        transition: exiting ? 'opacity 0.45s ease' : 'opacity 0.3s ease',
      }}
    >
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, hsl(152,70%,42%), transparent 70%)' }} />
        <div className="absolute -bottom-60 -left-40 w-[700px] h-[700px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, hsl(222,47%,40%), transparent 70%)' }} />
      </div>

      <div
        className="relative z-10 flex flex-col items-center gap-7"
        style={{
          opacity: visible && !exiting ? 1 : 0,
          transform: visible && !exiting ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Logo + pulse rings */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-24 h-24 rounded-full"
            style={{ border: '1.5px solid hsl(152,70%,48%,0.18)', animation: 'loader-ping 2s ease infinite' }} />
          <div className="absolute w-16 h-16 rounded-full"
            style={{ border: '1.5px solid hsl(152,70%,48%,0.28)', animation: 'loader-ping 2s ease 0.35s infinite' }} />
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center"
            style={{ boxShadow: '0 8px 28px -6px rgb(0 0 0 / 0.12), 0 0 0 1px hsl(215,20%,91%)' }}>
            <img src="/Texa_Logo.jpeg" alt="Texawave" className="w-10 h-10 object-contain" />
          </div>
        </div>

        {/* Welcome */}
        <div className="text-center space-y-0.5">
          <h2 className="text-[18px] font-bold text-slate-800 tracking-tight">
            Welcome back,{' '}
            <span style={{ color: 'hsl(152,70%,36%)' }}>
              {(userName || 'User').split(' ')[0]}
            </span>
            !
          </h2>
          <p className="text-[13px] text-slate-500">Setting up your workspace</p>
        </div>

        {/* ERP Module grid */}
        <div className="grid grid-cols-5 gap-2.5 px-2">
          {ERP_MODULES.map(({ icon: Icon, label, color }, i) => {
            const isLoaded  = loadedModules.includes(i);
            const isActive  = activeModule === i && !loadedModules.includes(i - 1 < 0 ? 999 : i);

            return (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5"
                style={{
                  opacity: isLoaded ? 1 : 0.2,
                  transform: isLoaded ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(4px)',
                  transition: `opacity 0.3s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: isLoaded ? `${color}18` : 'hsl(215,18%,92%)',
                    border: `1.5px solid ${isLoaded ? color + '30' : 'hsl(215,18%,88%)'}`,
                    boxShadow: isLoaded ? `0 2px 8px -2px ${color}40` : 'none',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <Icon
                    className="w-4 h-4"
                    style={{ color: isLoaded ? color : 'hsl(215,15%,70%)', transition: 'color 0.3s ease' }}
                  />
                </div>
                <span
                  className="text-[9px] font-medium text-center leading-tight"
                  style={{ color: isLoaded ? 'hsl(222,20%,40%)' : 'hsl(215,15%,72%)', transition: 'color 0.3s ease' }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress section */}
        <div className="w-72 space-y-2.5">
          {/* Current module label */}
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-500">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'hsl(152,70%,44%)' }} />
              Loading {currentModule.label}...
            </div>
            <span className="tabular-nums text-slate-400 font-medium">{Math.round(progress)}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, hsl(152,76%,32%), hsl(152,70%,50%))',
                boxShadow: '0 0 8px hsl(152,70%,44%,0.45)',
                transition: 'width 0.06s linear',
              }}
            />
          </div>

          {/* Segment dots */}
          <div className="flex gap-1.5 justify-center">
            {ERP_MODULES.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-200"
                style={{
                  width: loadedModules.includes(i) ? '16px' : '5px',
                  height: '5px',
                  background: loadedModules.includes(i)
                    ? 'linear-gradient(90deg, hsl(152,76%,32%), hsl(152,70%,50%))'
                    : 'hsl(215,18%,86%)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes loader-ping {
          0%   { transform: scale(1);    opacity: 0.6; }
          70%  { transform: scale(1.65); opacity: 0; }
          100% { transform: scale(1.65); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
