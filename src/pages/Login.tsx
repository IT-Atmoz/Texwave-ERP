import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Lock, User, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const success = await login(identifier, password);
      if (success) {
        sessionStorage.setItem('justLoggedIn', '1');
      } else {
        toast.error('Invalid username or password');
        setLoading(false);
      }
    } catch {
      toast.error('Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'hsl(215, 28%, 97%)' }}
    >
      {/* Soft background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, hsl(152,70%,42%), transparent 70%)' }}
        />
        <div
          className="absolute -bottom-60 -left-40 w-[700px] h-[700px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, hsl(222,47%,40%), transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, hsl(152,60%,36%), transparent 70%)' }}
        />
      </div>

      <div className="w-full max-w-[400px] relative z-10 animate-fade-in-up">

        {/* Logo & branding */}
        <div className="text-center mb-7">
          <div
            className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-2xl mb-4 overflow-hidden shadow-lg"
            style={{
              background: 'white',
              boxShadow: '0 8px 32px -8px rgb(0 0 0 / 0.12), 0 2px 8px -2px rgb(0 0 0 / 0.08)',
            }}
          >
            <img src="/Texa_Logo.jpeg" alt="Texawave Logo" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Texawave ERP</h1>
          <p className="text-slate-400 text-sm mt-1">Enterprise Resource Planning</p>
        </div>

        {/* Card */}
        <div
          className="bg-white rounded-2xl p-7 border border-slate-200/80"
          style={{ boxShadow: '0 4px 24px -6px rgb(0 0 0 / 0.08), 0 2px 8px -2px rgb(0 0 0 / 0.05)' }}
        >
          <div className="mb-5">
            <h2 className="text-[18px] font-bold text-slate-900">Welcome back</h2>
            <p className="text-slate-500 text-sm mt-0.5">Sign in to access your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email / Username */}
            <div className="space-y-1.5">
              <Label htmlFor="identifier" className="text-[13px] font-semibold text-slate-700">
                Email or Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="identifier"
                  type="text"
                  placeholder="Enter your email or username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  className="pl-9 h-[42px] bg-slate-50/80 border-slate-200 text-slate-900
                    placeholder:text-slate-400 rounded-lg
                    focus:bg-white focus:border-primary/60 focus:ring-2 focus:ring-primary/15
                    transition-all duration-200"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] font-semibold text-slate-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-9 pr-10 h-[42px] bg-slate-50/80 border-slate-200 text-slate-900
                    placeholder:text-slate-400 rounded-lg
                    focus:bg-white focus:border-primary/60 focus:ring-2 focus:ring-primary/15
                    transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400
                    hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[42px] mt-1 rounded-lg font-semibold text-sm text-white
                flex items-center justify-center gap-2 transition-all duration-200
                hover:brightness-105 hover:shadow-lg hover:-translate-y-0.5
                active:translate-y-0 active:brightness-95
                disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              style={{
                background: 'linear-gradient(135deg, hsl(152,76%,30%), hsl(152,70%,42%))',
                boxShadow: '0 4px 14px -3px hsl(152,70%,36%,0.45)',
              }}
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

        </div>

        <p className="text-center text-[11px] text-slate-400 mt-5">
          Texawave Pvt Ltd &copy; {new Date().getFullYear()}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
