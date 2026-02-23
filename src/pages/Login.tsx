import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Lock, User, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

function GearLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
      <style>{`
        @keyframes spinCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spinCCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes progressBar {
          from { width: 0%; }
          to { width: 100%; }
        }
        .gear-cw { animation: spinCW 1.5s linear infinite; }
        .gear-ccw { animation: spinCCW 1.2s linear infinite; }
        .gear-cw-slow { animation: spinCW 2s linear infinite; }
        .slide-in { animation: slideIn 0.4s ease-out forwards; }
        .progress-fill { animation: progressBar 1.5s ease-in-out forwards; }
      `}</style>

      <div className="relative w-48 h-48 mb-8">
        {/* Large gear - center */}
        <svg className="gear-cw absolute top-4 left-6" width="90" height="90" viewBox="0 0 100 100">
          <path d="M50 10 L54 10 L56 2 L60 2 L62 10 L66 12 L72 6 L76 8 L74 16 L78 20 L86 18 L88 22 L80 26 L82 30 L90 34 L90 38 L82 40 L82 44 L90 48 L90 52 L82 54 L80 58 L88 62 L86 66 L78 64 L74 68 L76 76 L72 78 L66 72 L62 74 L60 82 L56 82 L54 74 L50 74 L46 82 L42 82 L40 74 L36 72 L30 78 L26 76 L28 68 L24 64 L16 66 L14 62 L22 58 L20 54 L12 52 L12 48 L20 46 L20 42 L12 38 L12 34 L20 30 L22 26 L14 22 L16 18 L24 20 L28 16 L26 8 L30 6 L36 12 L40 10 L42 2 L46 2 L48 10Z"
            fill="#1a5c10" stroke="#0f3a08" strokeWidth="1"/>
          <circle cx="50" cy="42" r="16" fill="#ffffff" stroke="#0f3a08" strokeWidth="1.5"/>
        </svg>

        {/* Small gear - top right */}
        <svg className="gear-ccw absolute -top-1 right-2" width="55" height="55" viewBox="0 0 100 100">
          <path d="M50 10 L54 10 L56 2 L60 2 L62 10 L66 12 L72 6 L76 8 L74 16 L78 20 L86 18 L88 22 L80 26 L82 30 L90 34 L90 38 L82 40 L82 44 L90 48 L90 52 L82 54 L80 58 L88 62 L86 66 L78 64 L74 68 L76 76 L72 78 L66 72 L62 74 L60 82 L56 82 L54 74 L50 74 L46 82 L42 82 L40 74 L36 72 L30 78 L26 76 L28 68 L24 64 L16 66 L14 62 L22 58 L20 54 L12 52 L12 48 L20 46 L20 42 L12 38 L12 34 L20 30 L22 26 L14 22 L16 18 L24 20 L28 16 L26 8 L30 6 L36 12 L40 10 L42 2 L46 2 L48 10Z"
            fill="#5aaf20" stroke="#3d8010" strokeWidth="1"/>
          <circle cx="50" cy="42" r="16" fill="#ffffff" stroke="#3d8010" strokeWidth="1.5"/>
        </svg>

        {/* Medium gear - bottom right */}
        <svg className="gear-cw-slow absolute bottom-0 right-0" width="65" height="65" viewBox="0 0 100 100">
          <path d="M50 10 L54 10 L56 2 L60 2 L62 10 L66 12 L72 6 L76 8 L74 16 L78 20 L86 18 L88 22 L80 26 L82 30 L90 34 L90 38 L82 40 L82 44 L90 48 L90 52 L82 54 L80 58 L88 62 L86 66 L78 64 L74 68 L76 76 L72 78 L66 72 L62 74 L60 82 L56 82 L54 74 L50 74 L46 82 L42 82 L40 74 L36 72 L30 78 L26 76 L28 68 L24 64 L16 66 L14 62 L22 58 L20 54 L12 52 L12 48 L20 46 L20 42 L12 38 L12 34 L20 30 L22 26 L14 22 L16 18 L24 20 L28 16 L26 8 L30 6 L36 12 L40 10 L42 2 L46 2 L48 10Z"
            fill="#2e7a14" stroke="#1a5c0a" strokeWidth="1"/>
          <circle cx="50" cy="42" r="16" fill="#ffffff" stroke="#1a5c0a" strokeWidth="1.5"/>
        </svg>
      </div>

      <div className="slide-in text-center">
        <p className="text-xl font-bold text-gray-800 mb-1">Initializing System</p>
        <p className="text-sm text-gray-500 mb-6">Setting up your workspace...</p>
      </div>

      {/* Progress bar */}
      <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="progress-fill h-full bg-gradient-to-r from-[#1a5c10] via-[#2e7a14] to-[#7dc418] rounded-full" />
      </div>
    </div>
  );
}

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const success = await login(identifier, password);

      if (success) {
        setLoading(false);
        setShowLoader(true);
        // Read the role from localStorage (set by login())
        setTimeout(() => {
          const saved = localStorage.getItem('erp_user');
          const role = saved ? JSON.parse(saved).role : null;
          if (role === 'employee') {
            navigate('/employee/dashboard');
          } else {
            navigate('/dashboard');
          }
        }, 1500);
      } else {
        toast.error('Invalid username/email or password');
        setLoading(false);
      }
    } catch {
      toast.error('Login failed. Please try again.');
      setLoading(false);
    }
  };

  if (showLoader) {
    return <GearLoader />;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, hsl(108,55%,10%) 0%, hsl(108,45%,16%) 50%, hsl(93,40%,22%) 100%)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white shadow-xl mb-4 p-2">
            <img src="/Texa_Logo.jpeg" alt="Texawave Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Texawave ERP</h1>
          <p className="text-white/60 text-sm mt-1">Enterprise Resource Planning</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-white/10 p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 text-sm mt-1">Sign in to access your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-sm font-semibold text-gray-700">Email or Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="identifier"
                  type="text"
                  placeholder="Enter your email or username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  className="pl-10 h-12 bg-gray-50 border-gray-200 focus:bg-white focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-gray-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-12 h-12 bg-gray-50 border-gray-200 focus:bg-white focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold shadow-lg transition-all"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3 font-medium uppercase tracking-wider">Demo Credentials</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setIdentifier('admin'); setPassword('admin123'); }}
                className="p-2.5 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors text-left group cursor-pointer"
              >
                <p className="font-semibold text-sm text-primary group-hover:text-primary/80">admin</p>
                <p className="text-xs text-primary/60">All access</p>
              </button>
              <button
                type="button"
                onClick={() => { setIdentifier('sales'); setPassword('sales123'); }}
                className="p-2.5 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors text-left group cursor-pointer"
              >
                <p className="font-semibold text-sm text-primary group-hover:text-primary/80">sales</p>
                <p className="text-xs text-primary/60">Sales only</p>
              </button>
              <button
                type="button"
                onClick={() => { setIdentifier('hr'); setPassword('hr123'); }}
                className="p-2.5 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors text-left group cursor-pointer"
              >
                <p className="font-semibold text-sm text-primary group-hover:text-primary/80">hr</p>
                <p className="text-xs text-primary/60">HR only</p>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-white/40 mt-6">
          Texawave Pvt Ltd &copy; {new Date().getFullYear()}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
