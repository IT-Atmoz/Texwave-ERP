import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
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
        // LoginRoute / EmployeeProtectedRoute will redirect automatically
        // when AuthContext user state updates — no manual navigate needed.
        setLoading(false);
      } else {
        toast.error('Invalid username/email or password');
        setLoading(false);
      }
    } catch {
      toast.error('Login failed. Please try again.');
      setLoading(false);
    }
  };

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
