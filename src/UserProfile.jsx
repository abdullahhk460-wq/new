import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Dumbbell, User, Calendar, Settings, LogOut, Home,
  Award, AlertCircle, CheckCircle2, Activity, FileText,
  Lock, Heart, Sparkles, Scale, Info, Menu, X, Phone,
  Star, MessageSquare, Trash2
} from 'lucide-react';
import {
  getActiveUser, isUserAuthenticated, userLogout,
  fetchMyBookings, updateUserProfile, changeUserPassword,
  attemptUserLogin, attemptSignup
} from './userAuth';
import { getMemberAccessToken } from './apiClient';
import { startMemberSessionKeepAlive } from './sessionRefresh';
import {
  isPaidStatus,
  isActiveMembershipStatus,
  normalizeBookingStatus,
} from './bookingStatus';
import {
  fetchBiometrics,
  saveBiometrics,
  fetchMyReviews,
  createReview,
  updateReview,
  deleteReview,
} from './profileApi';

export default function UserProfile() {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  
  // Auth Form Inputs
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState(null);
  const [authSubmitLoading, setAuthSubmitLoading] = useState(false);

  // Profile Dashboard Navigation Tab
  const [activeTab, setActiveTab] = useState('overview');

  // User Data State
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState(null);

  const [biometricsLoading, setBiometricsLoading] = useState(false);
  const [biometrics, setBiometrics] = useState({
    weight: 0,
    height: 0,
    bodyFat: 0,
    muscleMass: 0,
    targetWeight: 0,
    logs: []
  });

  const [bioInput, setBioInput] = useState({
    weight: '',
    bodyFat: '',
    muscleMass: ''
  });

  // Settings Form State
  const [profileName, setProfileName] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [settingsError, setSettingsError] = useState(null);
  const [settingsSuccess, setSettingsSuccess] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    comment: '',
    displayRole: '',
    avatarUrl: '',
  });
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const [toastMessage, setToastMessage] = useState(null);
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ── Authentication Checks ──────────────────────────────────────────────────
  const verifySession = async () => {
    setAuthLoading(true);
    const authed = await isUserAuthenticated();
    if (authed) {
      const user = getActiveUser();
      setCurrentUser(user);
      setProfileName(user.name || '');
      loadUserBookings();
      await migrateLegacyBiometricsOnce(user.id);
      loadSecureBiometrics();
      loadMemberReviews();
    } else {
      setCurrentUser(null);
    }
    setAuthLoading(false);
  };

  useEffect(() => {
    verifySession();
  }, []);

  useEffect(() => {
    if (!currentUser) return undefined;
    return startMemberSessionKeepAlive();
  }, [currentUser]);

  const loadSecureBiometrics = async () => {
    setBiometricsLoading(true);
    const res = await fetchBiometrics();
    if (res.success && res.biometrics) {
      setBiometrics({
        weight: res.biometrics.weight || 0,
        height: res.biometrics.height || 0,
        bodyFat: res.biometrics.bodyFat || 0,
        muscleMass: res.biometrics.muscleMass || 0,
        targetWeight: res.biometrics.targetWeight || 0,
        logs: res.biometrics.logs || [],
      });
      setBiometricsLoading(false);
      return;
    }
    setBiometricsLoading(false);
  };

  const loadMemberReviews = async () => {
    setReviewsLoading(true);
    const res = await fetchMyReviews();
    if (res.success) {
      setReviews(res.reviews);
      if (res.reviews.length > 0) {
        const r = res.reviews[0];
        setEditingReviewId(r.id);
        setReviewForm({
          rating: r.rating,
          comment: r.comment,
          displayRole: r.displayRole || '',
          avatarUrl: r.avatarUrl || '',
        });
      }
    }
    setReviewsLoading(false);
  };

  const migrateLegacyBiometricsOnce = async (userId) => {
    const key = `den_user_biometrics_${userId}`;
    const saved = localStorage.getItem(key);
    if (!saved) return;
    try {
      const legacy = JSON.parse(saved);
      await saveBiometrics({
        weight: legacy.weight || null,
        height: legacy.height || null,
        bodyFat: legacy.bodyFat || null,
        muscleMass: legacy.muscleMass || null,
        targetWeight: legacy.targetWeight || null,
        logs: legacy.logs || [],
      });
      localStorage.removeItem(key);
      localStorage.removeItem('den_user_biometrics');
    } catch {
      // ignore corrupt legacy data
    }
  };

  // ── Load Bookings from API (Supabase) ──────────────────────────────────────
  const loadUserBookings = async () => {
    setBookingsLoading(true);
    setBookingsError(null);
    const res = await fetchMyBookings();
    setBookingsLoading(false);
    if (res.success) {
      setBookings(res.bookings || []);
    } else {
      setBookingsError(res.error || 'Failed to fetch membership info');
    }
  };

  // ── Auth Handlers ─────────────────────────────────────────────────────────
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError('Email and password are required');
      return;
    }
    setAuthSubmitLoading(true);
    setAuthError(null);
    const res = await attemptUserLogin(authEmail, authPassword);
    setAuthSubmitLoading(false);
    if (res.success) {
      setCurrentUser(res.user);
      setProfileName(res.user.name);
      triggerToast(`👋 Welcome back, ${res.user.name}!`);
      loadUserBookings();
      loadSecureBiometrics();
      loadMemberReviews();
    } else {
      setAuthError(res.error || 'Invalid credentials');
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!authName || !authEmail || !authPassword) {
      setAuthError('All fields are required');
      return;
    }
    setAuthSubmitLoading(true);
    setAuthError(null);
    const res = await attemptSignup(authName, authEmail, authPassword);
    setAuthSubmitLoading(false);
    if (res.success) {
      setCurrentUser(res.user);
      setProfileName(res.user.name);
      setAuthPassword('');
      setAuthError(null);
      triggerToast(`🎉 Welcome, ${res.user.name}! Your account is ready.`);
      loadUserBookings();
      loadSecureBiometrics();
      loadMemberReviews();
    } else {
      setAuthError(res.error || 'Registration failed');
    }
  };

  const handleLogoutClick = async () => {
    await userLogout();
    setCurrentUser(null);
    setBookings([]);
    triggerToast('🔒 Logged out successfully');
  };

  // ── Biometrics Logic ───────────────────────────────────────────────────────
  const calculateBMI = (w, h) => {
    if (!w || !h) return 0;
    const heightInMeters = h / 100;
    return (w / (heightInMeters * heightInMeters)).toFixed(1);
  };

  const getBMICategory = (bmi) => {
    if (!bmi || parseFloat(bmi) <= 0) return { label: 'Unset', color: 'text-zinc-500' };
    if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-400' };
    if (bmi < 25) return { label: 'Normal Weight', color: 'text-emerald-400' };
    if (bmi < 30) return { label: 'Overweight', color: 'text-amber-400' };
    return { label: 'Obese', color: 'text-red-500' };
  };

  const handleBiometricsSubmit = async (e) => {
    e.preventDefault();
    const w = parseFloat(bioInput.weight);
    const bf = parseFloat(bioInput.bodyFat) || null;
    const mm = parseFloat(bioInput.muscleMass) || null;

    if (!w || isNaN(w)) {
      triggerToast('⚠️ Please enter a valid weight');
      return;
    }

    const newLog = {
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weight: w,
      bodyFat: bf,
      muscleMass: mm,
    };

    const updatedBio = {
      weight: w,
      height: biometrics.height || null,
      bodyFat: bf || biometrics.bodyFat || null,
      muscleMass: mm || biometrics.muscleMass || null,
      targetWeight: biometrics.targetWeight || null,
      logs: [newLog, ...biometrics.logs].slice(0, 30),
    };

    const res = await saveBiometrics(updatedBio);
    if (res.success) {
      setBiometrics({
        weight: res.biometrics.weight || 0,
        height: res.biometrics.height || 0,
        bodyFat: res.biometrics.bodyFat || 0,
        muscleMass: res.biometrics.muscleMass || 0,
        targetWeight: res.biometrics.targetWeight || 0,
        logs: res.biometrics.logs || [],
      });
      setBioInput({ weight: '', bodyFat: '', muscleMass: '' });
      triggerToast('📊 Biometrics saved securely on server');
    } else {
      triggerToast(res.error || 'Failed to save biometrics');
    }
  };

  const persistHeight = async (heightVal) => {
    const res = await saveBiometrics({
      ...biometrics,
      height: heightVal,
      logs: biometrics.logs,
    });
    if (res.success) {
      setBiometrics((prev) => ({ ...prev, height: heightVal }));
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (reviewForm.comment.trim().length < 10) {
      triggerToast('⚠️ Review must be at least 10 characters');
      return;
    }

    const authed = await isUserAuthenticated();
    if (!authed && !getMemberAccessToken()) {
      triggerToast('⚠️ Session expired — please sign in again');
      setCurrentUser(null);
      return;
    }

    setReviewSubmitting(true);
    const payload = {
      rating: reviewForm.rating,
      comment: reviewForm.comment.trim(),
      displayRole: reviewForm.displayRole.trim() || null,
      avatarUrl: reviewForm.avatarUrl.trim() || null,
    };
    const res = editingReviewId
      ? await updateReview(editingReviewId, payload)
      : await createReview(payload);
    setReviewSubmitting(false);
    if (res.success) {
      triggerToast('✅ Review submitted. Admin will decide if it appears on the homepage.');
      loadMemberReviews();
    } else {
      triggerToast(res.error || 'Failed to save review');
    }
  };

  const handleDeleteReview = async (id) => {
    if (!window.confirm('Delete this review?')) return;
    const res = await deleteReview(id);
    if (res.success) {
      triggerToast('🗑️ Review deleted');
      loadMemberReviews();
      if (editingReviewId === id) {
        setEditingReviewId(null);
        setReviewForm({ rating: 5, comment: '', displayRole: '', avatarUrl: '' });
      }
    } else {
      triggerToast(res.error || 'Delete failed');
    }
  };

  const reviewStatusLabel = (status) => {
    if (status === 'approved') return { text: 'Published on homepage', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    if (status === 'rejected') return { text: 'Not published', cls: 'text-red-400 bg-red-500/10 border-red-500/20' };
    return { text: 'Waiting for admin', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
  };

  const getBiometricAdvice = (bmi, bodyFat) => {
    if (!bmi || parseFloat(bmi) <= 0) {
      return 'Log your weight and height below to receive custom athletic recommendations and calculate your BMI category.';
    }
    if (bmi >= 25) {
      return 'Recommendation: Focus on caloric deficit + heavy lifting. Standard Plan Cardio & Weight training morning slots are highly recommended to shred body fat while maintaining absolute torque output.';
    }
    if (bodyFat && bodyFat < 12) {
      return 'Recommendation: Bulking phase active. Focus on caloric surplus and progressive overload. Standard/Premium weight training slots are ideal. Keep protein intake above 2.0g/kg.';
    }
    return 'Recommendation: Athletic profile. Focus on strength building and cardiovascular stamina. Combine plate-loaded Hammer Strength sets with active rowers.';
  };

  // ── Profile Settings Logic ─────────────────────────────────────────────────
  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) {
      setSettingsError('Name cannot be empty');
      return;
    }
    setSettingsLoading(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    const res = await updateUserProfile(profileName);
    setSettingsLoading(false);
    if (res.success) {
      setCurrentUser(res.user);
      setSettingsSuccess('Name updated successfully!');
      triggerToast('👤 Profile details updated');
    } else {
      setSettingsError(res.error || 'Failed to update profile');
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      setSettingsError('Both old and new passwords are required');
      return;
    }
    if (newPassword.length < 8) {
      setSettingsError('New password must be at least 8 characters long');
      return;
    }
    setSettingsLoading(true);
    setSettingsError(null);
    setSettingsSuccess(null);
    const res = await changeUserPassword(oldPassword, newPassword);
    setSettingsLoading(false);
    if (res.success) {
      setSettingsSuccess('Password changed successfully! Please log in again.');
      setOldPassword('');
      setNewPassword('');
      triggerToast('🔑 Password changed. Session revoked.');
      // Delay logout to let user see success message
      setTimeout(() => {
        setCurrentUser(null);
      }, 2000);
    } else {
      setSettingsError(res.error || 'Failed to change password');
    }
  };

  // Active membership checker
  const activeBooking = bookings.find((b) => isActiveMembershipStatus(b.status));

  return (
    <div className="bg-[#050507] text-zinc-100 min-h-screen font-sans selection:bg-red-500 selection:text-white pb-12">
      
      {/* Toast Notifications */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-[999] border border-zinc-850 bg-zinc-950/95 text-white py-3 px-5 rounded-lg shadow-2xl animate-slideUp flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span className="text-xs sm:text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-black/40 backdrop-blur-xl border-b border-zinc-900 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          
          {/* Logo with Modern Icon */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 transition-all group-hover:border-red-500/50 flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-red-500 transition-transform group-hover:rotate-45" />
            </div>
            <span className="font-display font-extrabold text-xl tracking-tighter text-white">
              THE <span className="text-red-500">DEN</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {['about', 'services', 'plans', 'trainers', 'gallery', 'faqs', 'contact'].map((sect) => (
              <a 
                key={sect}
                href={`/#${sect}`} 
                className="text-zinc-400 hover:text-white transition font-semibold text-xs tracking-widest uppercase relative py-1.5 group overflow-hidden"
              >
                {sect === 'plans' ? 'Plans' : sect === 'faqs' ? 'FAQs' : sect.replace('-', ' ')}
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-red-500 -translate-x-[102%] group-hover:translate-x-0 transition-transform duration-350" />
              </a>
            ))}
          </nav>
          
          <div className="hidden md:flex items-center gap-4">
            <Link 
              to="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-xs font-bold transition text-zinc-300"
            >
              <Home className="w-3.5 h-3.5" /> Back to Home
            </Link>
            {currentUser && (
              <button 
                onClick={handleLogoutClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/10 border border-red-900/20 text-red-400 text-xs font-bold hover:bg-red-950/25 transition"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            )}
          </div>

          {/* Hamburger Menu Toggle */}
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white">
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 py-6 px-4 flex flex-col gap-4 animate-fadeIn">
            {['about', 'services', 'plans', 'trainers', 'gallery', 'faqs', 'contact'].map((sect) => (
              <a 
                key={sect}
                href={`/#${sect}`} 
                onClick={() => setIsMenuOpen(false)} 
                className="text-zinc-300 hover:text-white py-2 text-sm font-bold uppercase tracking-widest border-b border-zinc-900"
              >
                {sect.replace('-', ' ')}
              </a>
            ))}
            
            <div className="flex flex-col gap-3 pt-2">
              <Link 
                to="/"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-bold text-xs uppercase tracking-wider"
              >
                <Home className="w-4 h-4 text-red-500" /> Back to Home
              </Link>
              {currentUser && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogoutClick();
                  }}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded bg-red-955/20 hover:bg-red-955/35 border border-red-900/30 text-red-400 font-bold text-xs uppercase tracking-wider transition"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Loading Fallback */}
      {authLoading ? (
        <div className="max-w-7xl mx-auto px-4 py-24 text-center">
          <Activity className="w-8 h-8 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-sm text-zinc-500">Checking session credentials...</p>
        </div>
      ) : !currentUser ? (
        
        // ── AUTHENTICATION FALLBACK PANEL ──
        <div className="max-w-md mx-auto px-4 py-16">
          <div className="bg-[#08080c] border border-zinc-900 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="text-center mb-6">
              <Dumbbell className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">MEMBER PORTAL</h1>
              <p className="text-xs text-zinc-500 mt-1">Access your profile tools, membership cards, & progress logs</p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-900 mb-6">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(null); }}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition ${authMode === 'login' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition ${authMode === 'signup' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Sign Up
              </button>
            </div>

            {authError && (
              <div className="p-3 bg-red-955/20 border border-red-900/30 text-red-400 rounded-lg text-xs font-semibold flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={authMode === 'login' ? handleLoginSubmit : handleSignupSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Abdullah Hanif"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-850 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@gmail.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-850 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-850 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={authSubmitLoading}
                className="w-full py-3.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 mt-6 disabled:opacity-50"
              >
                {authSubmitLoading ? 'Processing...' : authMode === 'login' ? 'Sign In to Portal' : 'Register Account'}
              </button>
            </form>
          </div>
        </div>

      ) : (

        // ── FULL MEMBER DASHBOARD ──
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-[#0e0a0a] border border-zinc-900 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:justify-between gap-6 mb-8">
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
                <Sparkles className="w-4.5 h-4.5 text-red-500" />
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Active Member Workspace</span>
              </div>
              <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">
                WELCOME BACK, {currentUser.name.toUpperCase()}!
              </h1>
              <p className="text-xs text-zinc-400 mt-1">Manage your active plans, track your biometrics progression, and view gym logs.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-[10px] text-zinc-550 uppercase font-bold tracking-wider">Member Ref</p>
                <p className="text-xs font-mono font-bold text-zinc-300">••••{String(currentUser.id).slice(-4)}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <User className="w-6 h-6 text-zinc-400" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Sidebar navigation tabs */}
            <div className="space-y-2 lg:col-span-1">
              {[
                { id: 'overview', label: 'Dashboard Overview', icon: Activity },
                { id: 'membership', label: 'My Membership Plan', icon: Award },
                { id: 'biometrics', label: 'Body Biometrics Tool', icon: Scale },
                { id: 'reviews', label: 'Reviews & Testimonials', icon: MessageSquare },
                { id: 'schedule', label: 'Timings & Schedule', icon: Calendar },
                { id: 'settings', label: 'Account Settings', icon: Settings },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-xs font-extrabold uppercase tracking-wider transition text-left ${
                      activeTab === tab.id
                        ? 'bg-zinc-900 border-zinc-800 text-white shadow-lg'
                        : 'bg-transparent border-transparent text-zinc-450 hover:text-zinc-200 hover:bg-zinc-900/30'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-red-500' : 'text-zinc-500'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Main view panel */}
            <div className="lg:col-span-3">
              <div className="bg-[#08080c] border border-zinc-900 rounded-2xl p-6 sm:p-8 min-h-[450px]">
                
                {/* ── TAB 1: OVERVIEW ── */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <h2 className="font-display font-extrabold text-xl text-white tracking-tight border-b border-zinc-900 pb-3">DASHBOARD OVERVIEW</h2>
                    
                    {/* Membership quick check */}
                    {bookingsLoading ? (
                      <div className="p-8 text-center text-zinc-500">Checking active passes...</div>
                    ) : activeBooking ? (
                      <div className="p-5 bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-850 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                          <span className="bg-emerald-500/10 text-emerald-400 text-[9px] uppercase tracking-widest font-extrabold px-2.5 py-1 rounded-full border border-emerald-500/20">
                            Active Membership
                          </span>
                          <h3 className="font-display font-black text-2xl text-white mt-3 uppercase">
                            {activeBooking.plan} Tier Pass
                          </h3>
                          <p className="text-xs text-zinc-400 mt-1">
                            Slot Schedule: <span className="font-bold text-zinc-200">{activeBooking.classType}</span> | Timing slot: <span className="font-bold text-zinc-200">{activeBooking.timeSlot}</span>
                          </p>
                        </div>
                        <div className="text-left md:text-right shrink-0">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Billing Status</p>
                          <p className={`text-sm font-extrabold mt-1 uppercase ${isPaidStatus(activeBooking.status) ? 'text-emerald-400' : normalizeBookingStatus(activeBooking.status) === 'confirmed' ? 'text-blue-400' : 'text-amber-500'}`}>
                            {isPaidStatus(activeBooking.status) ? '✅ Paid & Active' : normalizeBookingStatus(activeBooking.status) === 'confirmed' ? '✓ Confirmed' : '⌛ Pending Invoice'}
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-2 block">Monthly PKR: <span className="font-bold text-white">{activeBooking.cost?.toLocaleString()}</span></p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 bg-zinc-950/60 border border-dashed border-zinc-850 rounded-xl text-center">
                        <Award className="w-8 h-8 text-zinc-650 mx-auto mb-3" />
                        <h3 className="text-sm font-bold text-zinc-300">No active memberships found</h3>
                        <p className="text-xs text-zinc-500 mt-1 mb-4">Book a premium plan at Nasir Bagh facility to activate your profile pass.</p>
                        <Link to="/" className="inline-block bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg transition">
                          Book Class Pass Now
                        </Link>
                      </div>
                    )}

                    {/* Biometrics widget summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                      <div className="p-4 bg-zinc-950/80 border border-zinc-900 rounded-xl text-left">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Current Weight</span>
                        <p className="text-2xl font-black text-white mt-1">
                          {biometrics.weight && parseFloat(biometrics.weight) > 0 ? (
                            <>
                              {biometrics.weight} <span className="text-xs text-zinc-500">KG</span>
                            </>
                          ) : (
                            <span className="text-zinc-650">--</span>
                          )}
                        </p>
                      </div>
                      
                      <div className="p-4 bg-zinc-950/80 border border-zinc-900 rounded-xl text-left">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">BMI Value</span>
                        <p className="text-2xl font-black text-white mt-1">
                          {calculateBMI(biometrics.weight, biometrics.height) && parseFloat(calculateBMI(biometrics.weight, biometrics.height)) > 0 ? (
                            <>
                              {calculateBMI(biometrics.weight, biometrics.height)}
                              <span className={`text-[10px] font-bold uppercase ml-2 ${getBMICategory(calculateBMI(biometrics.weight, biometrics.height)).color}`}>
                                ({getBMICategory(calculateBMI(biometrics.weight, biometrics.height)).label})
                              </span>
                            </>
                          ) : (
                            <span className="text-zinc-650">--</span>
                          )}
                        </p>
                      </div>

                      <div className="p-4 bg-zinc-950/80 border border-zinc-900 rounded-xl text-left">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Body Fat Percentage</span>
                        <p className="text-2xl font-black text-white mt-1">
                          {biometrics.bodyFat && parseFloat(biometrics.bodyFat) > 0 ? (
                            <>
                              {biometrics.bodyFat} <span className="text-xs text-zinc-500">%</span>
                            </>
                          ) : (
                            <span className="text-zinc-650">--</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl text-xs text-zinc-400 flex gap-2 text-left">
                      <Info className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{getBiometricAdvice(calculateBMI(biometrics.weight, biometrics.height), biometrics.bodyFat)}</span>
                    </div>

                  </div>
                )}

                {/* ── TAB 2: ACTIVE MEMBERSHIP PLAN ── */}
                {activeTab === 'membership' && (
                  <div className="space-y-6">
                    <h2 className="font-display font-extrabold text-xl text-white tracking-tight border-b border-zinc-900 pb-3">MY MEMBERSHIP DETAILS</h2>
                    
                    {bookingsLoading ? (
                      <div className="p-8 text-center text-zinc-500">Fetching records...</div>
                    ) : bookings.length === 0 ? (
                      <div className="text-center py-12">
                        <Award className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
                        <p className="text-sm text-zinc-500">You do not have any bookings registered.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {bookings.map((booking) => (
                          <div key={booking.id} className="bg-zinc-950/80 border border-zinc-900 rounded-xl p-5 text-left relative overflow-hidden">
                            <div className="absolute top-0 right-0 h-1.5 w-full bg-gradient-to-r from-red-500 to-rose-600" />
                            
                            <div className="flex justify-between items-start flex-wrap gap-4 mb-4">
                              <div>
                                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Transaction ID: {booking.id}</span>
                                <h3 className="font-display font-black text-xl text-white mt-1 uppercase">{booking.plan} Membership Plan</h3>
                              </div>
                              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded tracking-wider ${
                                isPaidStatus(booking.status)
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : normalizeBookingStatus(booking.status) === 'confirmed'
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {isPaidStatus(booking.status) ? '✅ Paid & Verified' : normalizeBookingStatus(booking.status) === 'confirmed' ? '✓ Confirmed' : '⌛ Pending Invoice'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-b border-zinc-900/60 my-4 text-xs">
                              <div>
                                <p className="text-zinc-550 font-bold uppercase text-[9px] tracking-wider">Timing Slot</p>
                                <p className="font-semibold text-zinc-200 mt-1">{booking.timeSlot}</p>
                              </div>
                              <div>
                                <p className="text-zinc-550 font-bold uppercase text-[9px] tracking-wider">Class Type</p>
                                <p className="font-semibold text-zinc-200 mt-1">{booking.classType}</p>
                              </div>
                              <div>
                                <p className="text-zinc-550 font-bold uppercase text-[9px] tracking-wider">Billing Amount</p>
                                <p className="font-semibold text-zinc-200 mt-1">PKR {booking.cost?.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-zinc-550 font-bold uppercase text-[9px] tracking-wider">Date Registered</p>
                                <p className="font-semibold text-zinc-200 mt-1">
                                  {new Date(booking.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </p>
                              </div>
                            </div>

                            {booking.comments && (
                              <div className="bg-zinc-900/30 p-3 rounded border border-zinc-900 text-xs text-zinc-400 my-3">
                                <b>Comments/Notes:</b> {booking.comments}
                              </div>
                            )}

                            {/* Digital Receipt mock */}
                            <div className="flex justify-between items-center pt-2 flex-wrap gap-2">
                              <p className="text-[10px] text-zinc-550">Please show this screen or transaction ID at the gym desk for instant check-in.</p>
                              <button 
                                onClick={() => {
                                  alert(`INVOICE PDF GENERATION SIMULATOR:\n\nGym Name: THE DEN FITNESS GYM\nClient: ${booking.name}\nEmail: ${booking.email}\nPlan: ${booking.plan}\nPrice: PKR ${booking.cost?.toLocaleString()}\nStatus: ${booking.status}\nDate: ${new Date(booking.createdAt).toLocaleDateString()}`);
                                }}
                                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition font-bold"
                              >
                                <FileText className="w-3.5 h-3.5" /> Download Invoice (PDF)
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 3: BIOMETRICS TRACKER PROFILE TOOL ── */}
                {activeTab === 'biometrics' && (
                  <div className="space-y-6">
                    <h2 className="font-display font-extrabold text-xl text-white tracking-tight border-b border-zinc-900 pb-3">BODY BIOMETRICS TRACKER</h2>
                    
                    <p className="text-xs text-zinc-400 text-left">
                      Metrics are stored securely on the server — not in browser storage. Only you can access this data when signed in.
                    </p>
                    {biometricsLoading && (
                      <p className="text-xs text-zinc-500">Loading secure biometrics…</p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Form inputs */}
                      <form onSubmit={handleBiometricsSubmit} className="md:col-span-1 space-y-4 bg-zinc-950 p-5 rounded-xl border border-zinc-900 text-left">
                        <h3 className="font-bold text-xs uppercase tracking-widest text-zinc-400 mb-2">Log Metric</h3>
                        
                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Weight (KG)</label>
                          <input
                            type="number"
                            step="0.1"
                            required
                            placeholder="e.g. 78.5"
                            value={bioInput.weight}
                            onChange={(e) => setBioInput({ ...bioInput, weight: e.target.value })}
                            className="w-full px-3 py-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-red-500 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Body Fat % (Optional)</label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="e.g. 15.4"
                            value={bioInput.bodyFat}
                            onChange={(e) => setBioInput({ ...bioInput, bodyFat: e.target.value })}
                            className="w-full px-3 py-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-red-500 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Muscle Mass KG (Optional)</label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="e.g. 36.2"
                            value={bioInput.muscleMass}
                            onChange={(e) => setBioInput({ ...bioInput, muscleMass: e.target.value })}
                            className="w-full px-3 py-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-red-500 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Height (CM)</label>
                          <input
                            type="number"
                            required
                            placeholder="e.g. 175"
                            value={biometrics.height || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setBiometrics((prev) => ({ ...prev, height: val }));
                            }}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              if (val > 0) persistHeight(val);
                            }}
                            className="w-full px-3 py-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-red-500 transition-colors"
                          />
                        </div>

                        <button 
                          type="submit"
                          className="w-full py-2.5 rounded bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-wider transition mt-3"
                        >
                          Save Log
                        </button>
                      </form>

                      {/* Progression logs */}
                      <div className="md:col-span-2 space-y-4">
                        <div className="bg-[#08080c] border border-zinc-900 rounded-xl p-4 text-left">
                          <h3 className="font-bold text-xs uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-1.5">
                            <Activity className="w-4 h-4 text-red-500" /> Metric Log History
                          </h3>

                          {biometrics.logs.length === 0 ? (
                            <div className="p-8 text-center text-zinc-600 text-xs border border-dashed border-zinc-850 rounded-lg">
                              No metrics logged yet. Save your weight above to compile your progress ledger.
                            </div>
                          ) : (
                            <div className="divide-y divide-zinc-900 overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="text-zinc-550 border-b border-zinc-900">
                                    <th className="py-2">Date</th>
                                    <th className="py-2">Weight</th>
                                    <th className="py-2">Body Fat</th>
                                    <th className="py-2">Muscle Mass</th>
                                    <th className="py-2">BMI</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                                  {biometrics.logs.map((log, idx) => (
                                    <tr key={idx} className="hover:bg-zinc-950/40">
                                      <td className="py-2.5 font-semibold text-zinc-450">{log.date}</td>
                                      <td className="py-2.5 font-bold text-white">{log.weight} kg</td>
                                      <td className="py-2.5">{log.bodyFat ? `${log.bodyFat}%` : '--'}</td>
                                      <td className="py-2.5">{log.muscleMass ? `${log.muscleMass} kg` : '--'}</td>
                                      <td className="py-2.5 font-semibold text-zinc-200">
                                        {biometrics.height > 0 ? calculateBMI(log.weight, biometrics.height) : '--'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* BMI chart mock / status */}
                        <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl text-left">
                          <h4 className="font-bold text-xs uppercase text-zinc-400 mb-2">Anatomical Profile Summary</h4>
                          <div className="flex gap-4 items-center flex-wrap">
                            <div className="px-4 py-2 bg-zinc-900 rounded-lg border border-zinc-800">
                              <p className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">Height</p>
                              <p className="text-sm font-bold text-white mt-0.5">{biometrics.height && biometrics.height > 0 ? `${biometrics.height} cm` : '--'}</p>
                            </div>
                            <div className="px-4 py-2 bg-zinc-900 rounded-lg border border-zinc-800">
                              <p className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">BMI Category</p>
                              <p className={`text-sm font-bold mt-0.5 ${getBMICategory(calculateBMI(biometrics.weight, biometrics.height)).color}`}>
                                {getBMICategory(calculateBMI(biometrics.weight, biometrics.height)).label}
                              </p>
                            </div>
                          </div>
                        </div>

                      </div>

                    </div>

                  </div>
                )}

                {/* ── TAB: REVIEWS & TESTIMONIALS ── */}
                {activeTab === 'reviews' && (
                  <div className="space-y-6 text-left">
                    <h2 className="font-display font-extrabold text-xl text-white tracking-tight border-b border-zinc-900 pb-3">
                      REVIEWS & TESTIMONIALS
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Write your gym experience below. Only admins can publish reviews on the public homepage testimonials section.
                    </p>

                    {reviews[0] && (
                      <div className={`p-3 rounded-lg border text-xs ${reviewStatusLabel(reviews[0].moderationStatus).cls}`}>
                        Status: {reviewStatusLabel(reviews[0].moderationStatus).text}
                      </div>
                    )}

                    <form onSubmit={handleReviewSubmit} className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                        {editingReviewId ? 'Update your review' : 'Write your review'}
                      </h3>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Star rating</label>
                        <select
                          value={reviewForm.rating}
                          onChange={(e) => setReviewForm((p) => ({ ...p, rating: Number(e.target.value) }))}
                          className="w-full px-3 py-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-white"
                        >
                          {[5, 4, 3, 2, 1].map((n) => (
                            <option key={n} value={n}>{n} stars</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Subtitle (optional)</label>
                        <input
                          value={reviewForm.displayRole}
                          onChange={(e) => setReviewForm((p) => ({ ...p, displayRole: e.target.value }))}
                          placeholder="e.g. Powerlifter · Standard Member"
                          className="w-full px-3 py-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Your review</label>
                        <textarea
                          rows={4}
                          value={reviewForm.comment}
                          onChange={(e) => setReviewForm((p) => ({ ...p, comment: e.target.value }))}
                          placeholder="Share your results, atmosphere, coaching quality…"
                          className="w-full px-3 py-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-white resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Photo URL (optional)</label>
                        <input
                          value={reviewForm.avatarUrl}
                          onChange={(e) => setReviewForm((p) => ({ ...p, avatarUrl: e.target.value }))}
                          placeholder="https://…"
                          className="w-full px-3 py-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-white"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={reviewSubmitting}
                        className="w-full py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase disabled:opacity-50"
                      >
                        {reviewSubmitting ? 'Submitting…' : editingReviewId ? 'Update review' : 'Submit review'}
                      </button>
                    </form>

                    {reviewsLoading && (
                      <p className="text-xs text-zinc-500">Loading your review…</p>
                    )}

                    {editingReviewId && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(editingReviewId)}
                        className="text-[10px] font-bold uppercase text-red-500/80 hover:text-red-400 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Delete my review
                      </button>
                    )}
                  </div>
                )}

                {/* ── TAB 4: TRAINING TIMINGS & SCHEDULE ── */}
                {activeTab === 'schedule' && (
                  <div className="space-y-6">
                    <h2 className="font-display font-extrabold text-xl text-white tracking-tight border-b border-zinc-900 pb-3">THE DEN GYM SCHEDULE</h2>
                    
                    <p className="text-xs text-zinc-400 text-left">
                      Nasir Bagh facility operating schedule. Please ensure your workout matches your preference slot.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                      <div className="p-5 bg-zinc-950 border border-zinc-900 rounded-xl space-y-3">
                        <h3 className="font-bold text-sm text-red-500 uppercase tracking-widest flex items-center gap-2">
                          <Calendar className="w-4 h-4" /> Weekly Timings
                        </h3>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between border-b border-zinc-900/60 pb-1.5">
                            <span className="text-zinc-450">Monday - Saturday</span>
                            <span className="font-bold text-white">06:00 AM - 10:30 PM</span>
                          </div>
                          <div className="flex justify-between border-b border-zinc-900/60 pb-1.5">
                            <span className="text-zinc-450">Sunday</span>
                            <span className="text-red-500 font-bold uppercase">Closed for Deep Clean</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-5 bg-zinc-950 border border-zinc-900 rounded-xl space-y-3">
                        <h3 className="font-bold text-sm text-red-500 uppercase tracking-widest flex items-center gap-2">
                          <Dumbbell className="w-4 h-4" /> Preference Slots
                        </h3>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between border-b border-zinc-900/60 pb-1.5">
                            <span className="text-zinc-450">🌅 Morning Session</span>
                            <span className="font-bold text-white">06:00 AM - 12:00 PM</span>
                          </div>
                          <div className="flex justify-between border-b border-zinc-900/60 pb-1.5">
                            <span className="text-zinc-450">☀️ Afternoon Session</span>
                            <span className="font-bold text-white">12:00 PM - 05:00 PM</span>
                          </div>
                          <div className="flex justify-between border-b border-zinc-900/60 pb-1.5">
                            <span className="text-zinc-450">🌃 Evening Session</span>
                            <span className="font-bold text-white">05:00 PM - 10:30 PM</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-zinc-950/60 border border-zinc-900 rounded-xl text-xs text-zinc-400 text-left">
                      <h4 className="font-bold text-white uppercase mb-1.5">Check-In Rules & Regulations:</h4>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Show your digital membership card (this dashboard) at the entrance desk scanners.</li>
                        <li>Clean indoor-only footwear is strictly required on plate-loaded Hammer Strength decks.</li>
                        <li>For personal training slots, notify your allocated coach 2 hours prior to scheduling modifications.</li>
                      </ul>
                    </div>

                  </div>
                )}

                {/* ── TAB 5: ACCOUNT SETTINGS ── */}
                {activeTab === 'settings' && (
                  <div className="space-y-6">
                    <h2 className="font-display font-extrabold text-xl text-white tracking-tight border-b border-zinc-900 pb-3">ACCOUNT SETTINGS</h2>
                    
                    {settingsError && (
                      <div className="p-3 bg-red-955/20 border border-red-900/30 text-red-400 rounded-lg text-xs font-semibold flex items-center gap-2 text-left">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{settingsError}</span>
                      </div>
                    )}

                    {settingsSuccess && (
                      <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-2 text-left">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{settingsSuccess}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                      
                      {/* Profile details */}
                      <form onSubmit={handleUpdateName} className="space-y-4">
                        <h3 className="font-bold text-sm text-white uppercase tracking-wider mb-2">Personal Details</h3>
                        
                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Email Address (Cannot Change)</label>
                          <input
                            type="text"
                            disabled
                            value={currentUser.email}
                            className="w-full px-3 py-2.5 text-xs rounded bg-zinc-900 border border-zinc-850 text-zinc-500 cursor-not-allowed"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Full Name</label>
                          <input
                            type="text"
                            required
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            className="w-full px-3 py-2.5 text-xs rounded bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-red-500 transition-colors"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={settingsLoading}
                          className="px-4 py-2 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-white font-bold text-xs uppercase tracking-wider transition disabled:opacity-50"
                        >
                          {settingsLoading ? 'Saving...' : 'Update Details'}
                        </button>
                      </form>

                      {/* Password change */}
                      <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <h3 className="font-bold text-sm text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-red-500" /> Change Password
                        </h3>

                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">Current Password</label>
                          <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            className="w-full px-3 py-2.5 text-xs rounded bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-red-500 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">New Password</label>
                          <input
                            type="password"
                            required
                            placeholder="Min. 8 chars, 1 capital, 1 number"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2.5 text-xs rounded bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-red-500 transition-colors"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={settingsLoading}
                          className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-wider transition disabled:opacity-50"
                        >
                          {settingsLoading ? 'Saving...' : 'Change Password'}
                        </button>
                      </form>

                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
