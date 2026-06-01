import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from './auth';
import { startAdminSessionKeepAlive } from './sessionRefresh';
import { Loader } from 'lucide-react';

/**
 * ProtectedRoute — wraps admin components.
 * Checks session validity via API (HttpOnly cookie) on every mount.
 * Shows a spinner while verifying to prevent flash-of-unauthenticated content.
 */
export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'authed' | 'denied'

  useEffect(() => {
    isAuthenticated().then((ok) => {
      if (ok) startAdminSessionKeepAlive();
      setStatus(ok ? 'authed' : 'denied');
    });
  }, []);

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader className="w-6 h-6 text-red-500 animate-spin" />
      </div>
    );
  }

  if (status === 'denied') {
    return <Navigate to="/secure-login" replace />;
  }

  return children;
}
