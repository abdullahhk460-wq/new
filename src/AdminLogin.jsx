import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { attemptLogin, isAuthenticated } from './auth';
import { startAdminSessionKeepAlive } from './sessionRefresh';
import { Dumbbell, Lock, Eye, EyeOff, ShieldAlert, AlertCircle, Loader, Mail, KeyRound } from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [isChecking, setIsChecking]     = useState(true);
  const [error, setError]               = useState(null);
  const [isLocked, setIsLocked]         = useState(false);

  // Check if already authenticated — redirect to dashboard
  useEffect(() => {
    (async () => {
      const authed = await isAuthenticated();
      if (authed) {
        navigate('/admin', { replace: true });
      } else {
        setIsChecking(false);
      }
    })();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError('Email and password are both required.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsLocked(false);

    const result = await attemptLogin(email, password);
    setIsLoading(false);

    if (result.success) {
      startAdminSessionKeepAlive();
      navigate('/admin', { replace: true });
    } else {
      const msg = result.error || 'Invalid credentials.';
      setIsLocked(msg.toLowerCase().includes('lock'));
      setError(msg);
      setPassword('');
    }
  };

  // Show spinner while checking existing session
  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader className="w-6 h-6 text-red-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background grid texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#0f0f0f_0%,_#050505_70%)]" />
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 40px, #333 40px, #333 41px),
                            repeating-linear-gradient(90deg, transparent, transparent 40px, #333 40px, #333 41px)`
        }}
      />

      {/* Login Card */}
      <div className="relative w-full max-w-md z-10">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 mb-4 shadow-2xl">
            <Dumbbell className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="font-display font-black text-2xl text-white tracking-tight uppercase">
            THE <span className="text-red-500">DEN</span> GYM
          </h1>
          <p className="text-zinc-500 text-xs mt-1 uppercase tracking-widest font-semibold">
            Authorized Personnel Only
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-8 shadow-2xl">
          
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 pb-5 border-b border-zinc-900">
            <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
              <Lock className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm uppercase tracking-wider">Admin Access Portal</h2>
              <p className="text-zinc-600 text-[10px]">Secure management console — restricted area</p>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className={`flex items-start gap-3 p-3.5 rounded-lg mb-5 border text-xs
              ${isLocked
                ? 'bg-red-500/5 border-red-500/20 text-red-400'
                : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
              }`}
            >
              {isLocked ? (
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">

            {/* Email */}
            <div>
              <label className="block text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-2">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  type="email"
                  id="admin-email"
                  autoComplete="off"
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@theden.com"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm
                             focus:outline-none focus:border-red-500/60 transition disabled:opacity-40
                             disabled:cursor-not-allowed placeholder:text-zinc-700"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="admin-password"
                  autoComplete="new-password"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full pl-10 pr-12 py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm
                             focus:outline-none focus:border-red-500/60 transition disabled:opacity-40
                             disabled:cursor-not-allowed placeholder:text-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full py-3.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-extrabold
                         text-[11px] uppercase tracking-widest transition active:scale-[0.98]
                         disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 shadow-lg"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Access Admin Panel</span>
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-5 border-t border-zinc-900">
            <p className="text-zinc-700 text-[9px] text-center leading-relaxed uppercase tracking-wider">
              🔐 Unauthorized access attempts are logged and monitored.<br />
              Sessions are secured with HttpOnly cookies and auto-rotate.
            </p>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center mt-6">
          <a href="/" className="text-zinc-700 hover:text-zinc-500 text-[10px] transition">
            ← Return to public website
          </a>
        </div>

      </div>
    </div>
  );
}
