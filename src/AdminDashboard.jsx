import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, getSessionUser } from './auth';
import { startAdminSessionKeepAlive } from './sessionRefresh';
import {
  Dumbbell, LogOut, Users, DollarSign, Clock, TrendingUp,
  Search, Trash2, Plus, X, CheckCircle2, BarChart2,
  Calendar, Phone, Mail, Download, Shield, Loader,
  RefreshCw, ChevronLeft, ChevronRight, Star, MessageSquare, Check, XCircle,
  Settings, Edit, Globe, EyeOff
} from 'lucide-react';
import { adminFetchReviews, adminModerateReview, adminUpdateReview, adminDeleteReview } from './profileApi';
import { refreshAdminSession } from './sessionRefresh';
import { adminFetchSettings, adminSaveSettings, DEFAULT_MSG, normalizeWhatsAppNumber } from './siteApi';
import {
  STATUS_CYCLE,
  STATUS_LABEL,
  STATUS_STYLES,
  normalizeBookingStatus,
  statusDisplayLabel,
} from './bookingStatus';
import { apiFetch, ensureCsrfToken } from './apiClient';

// ── AdminDashboard Component ──────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const admin = getSessionUser();

  // ── State ──────────────────────────────────────────────────────────────────
  const [bookings, setBookings]         = useState([]);
  const [totalCount, setTotalCount]     = useState(0);
  const [totalPages, setTotalPages]     = useState(1);
  const [page, setPage]                 = useState(1);
  const [search, setSearch]             = useState('');
  const [filterPlan, setFilterPlan]     = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isLoading, setIsLoading]       = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm]   = useState(false);
  const [addForm, setAddForm]           = useState({
    name: '', email: '', phone: '', plan: 'Standard', classType: 'Weight Training',
    initialStatus: 'confirmed',
  });
  const [toast, setToast]               = useState(null);
  const [autoLogoutTimer, setAutoLogoutTimer] = useState(30 * 60);
  const searchTimeout                   = useRef(null);
  const [adminView, setAdminView]       = useState('bookings');
  const [reviews, setReviews]           = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewFilter, setReviewFilter] = useState('all');
  const [reviewsError, setReviewsError] = useState(null);
  const [reviewCounts, setReviewCounts] = useState({ all: 0, pending: 0, published: 0, rejected: 0 });
  const [editingReview, setEditingReview] = useState(null);
  const [editReviewForm, setEditReviewForm] = useState({ rating: 5, comment: '', displayRole: '' });
  const [whatsappSettings, setWhatsappSettings] = useState({
    whatsappNumber: '923169636282',
    whatsappPrefillMessage: DEFAULT_MSG,
  });
  const [settingsError, setSettingsError] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/secure-login', { replace: true });
  }, [navigate]);

  // ── Auto-logout countdown ──────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setAutoLogoutTimer(prev => {
        if (prev <= 1) { handleLogout(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [handleLogout]);

  // Keep session alive without spamming refresh (max once per 10 min)
  useEffect(() => {
    return startAdminSessionKeepAlive();
  }, []);

  // Reset idle logout timer on activity (no API calls)
  useEffect(() => {
    let debounce;
    const onActivity = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => setAutoLogoutTimer(30 * 60), 500);
    };
    window.addEventListener('mousemove', onActivity);
    window.addEventListener('keydown', onActivity);
    return () => {
      clearTimeout(debounce);
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, []);

  // ── Load Bookings ──────────────────────────────────────────────────────────
  const loadBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      await ensureCsrfToken();
      const params = new URLSearchParams({ page, limit: 50 });
      if (search) params.set('search', search);
      if (filterPlan !== 'all') params.set('plan', filterPlan);
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const { ok, data, status } = await apiFetch(`/bookings/admin?${params}`);

      if (status === 401) {
        navigate('/secure-login', { replace: true });
        return;
      }

      if (ok && data.data) {
        setBookings(data.data.map((b) => ({ ...b, status: normalizeBookingStatus(b.status) })));
        setTotalCount(data.meta?.totalCount ?? data.data.length);
        setTotalPages(data.meta?.totalPages ?? 1);
      } else {
        showToast(data.message ? `⚠️ ${data.message}` : '⚠️ Failed to load bookings.');
      }
    } catch {
      showToast('⚠️ Connection error. Check if the server is running.');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, filterPlan, filterStatus, navigate, showToast]);

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      loadBookings();
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [search, filterPlan, filterStatus]);

  useEffect(() => { loadBookings(); }, [page]);

  const filterReviewsList = useCallback((list, filter) => {
    if (filter === 'all') return list;
    if (filter === 'published') {
      return list.filter((r) => r.moderationStatus === 'approved' && r.showOnWebsite);
    }
    return list.filter((r) => r.moderationStatus === filter);
  }, []);

  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);
    setReviewsError(null);
    await ensureCsrfToken();
    await refreshAdminSession(true);
    const res = await adminFetchReviews('all');
    if (res.success) {
      const list = res.reviews || [];
      setReviewCounts({
        all: list.length,
        pending: list.filter((r) => r.moderationStatus === 'pending').length,
        published: list.filter((r) => r.moderationStatus === 'approved' && r.showOnWebsite).length,
        rejected: list.filter((r) => r.moderationStatus === 'rejected').length,
      });
      setReviews(filterReviewsList(list, reviewFilter));
    } else {
      setReviews([]);
      const msg = res.error || 'Failed to load reviews';
      setReviewsError(msg);
      showToast(msg);
    }
    setReviewsLoading(false);
  }, [reviewFilter, showToast, filterReviewsList]);

  useEffect(() => {
    if (adminView === 'reviews') loadReviews();
  }, [adminView, reviewFilter, loadReviews]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    const res = await adminFetchSettings();
    if (res.success && res.settings) {
      setWhatsappSettings({
        whatsappNumber: res.settings.whatsappNumber,
        whatsappPrefillMessage: res.settings.whatsappPrefillMessage || DEFAULT_MSG,
      });
      setSettingsError(null);
    } else if (!res.success) {
      setSettingsError(res.error);
    }
    setSettingsLoading(false);
  }, []);

  useEffect(() => {
    if (adminView === 'settings') loadSettings();
  }, [adminView, loadSettings]);

  const saveWhatsappSettings = async (e) => {
    e.preventDefault();
    setSettingsError(null);
    setSettingsSaving(true);
    const res = await adminSaveSettings(whatsappSettings);
    setSettingsSaving(false);
    if (res.success) {
      showToast('✅ WhatsApp number updated on website');
      setWhatsappSettings({
        whatsappNumber: res.settings.whatsappNumber,
        whatsappPrefillMessage: res.settings.whatsappPrefillMessage || DEFAULT_MSG,
      });
    } else {
      setSettingsError(res.error);
      showToast(`⚠️ ${res.error || 'Failed to save settings'}`);
    }
  };

  const moderateReview = async (id, moderationStatus) => {
    const res = await adminModerateReview(id, {
      moderationStatus,
      showOnWebsite: moderationStatus === 'approved',
    });
    if (res.success) {
      showToast(moderationStatus === 'approved' ? '✅ Published on homepage' : 'Review updated');
      loadReviews();
    } else {
      showToast(res.error || 'Failed to update review');
    }
  };

  const unpublishReview = async (id) => {
    const res = await adminUpdateReview(id, { showOnWebsite: false, moderationStatus: 'pending' });
    if (res.success) {
      showToast('Review removed from homepage');
      loadReviews();
    } else showToast(res.error || 'Failed');
  };

  const deleteReview = async (id) => {
    if (!window.confirm('Delete this review permanently?')) return;
    const res = await adminDeleteReview(id);
    if (res.success) {
      showToast('🗑️ Review deleted');
      setEditingReview(null);
      loadReviews();
    } else showToast(res.error || 'Delete failed');
  };

  const openEditReview = (r) => {
    setEditingReview(r);
    setEditReviewForm({ rating: r.rating, comment: r.comment, displayRole: r.displayRole || '' });
  };

  const saveEditReview = async (e) => {
    e.preventDefault();
    if (!editingReview) return;
    const res = await adminUpdateReview(editingReview.id, editReviewForm);
    if (res.success) {
      showToast('✅ Review saved');
      setEditingReview(null);
      loadReviews();
    } else showToast(res.error || 'Save failed');
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const toggleStatus = async (booking) => {
    const current = normalizeBookingStatus(booking.status);
    const newStatus = STATUS_CYCLE[current];
    const { ok, data } = await apiFetch(`/bookings/admin/${booking.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    });
    if (ok) {
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: newStatus } : b));
      showToast(`✅ Status updated to ${STATUS_LABEL[newStatus]}.`);
    } else {
      showToast(data.message ? `⚠️ ${data.message}` : '⚠️ Failed to update status. Check Supabase service role key.');
    }
  };

  const deleteBooking = async (id) => {
    if (!window.confirm('Permanently delete this booking?')) return;
    const { ok } = await apiFetch(`/bookings/admin/${id}`, { method: 'DELETE' });
    if (ok) {
      setBookings(prev => prev.filter(b => b.id !== id));
      setTotalCount(prev => prev - 1);
      showToast('🗑️ Booking removed.');
    } else {
      showToast('⚠️ Failed to delete booking.');
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.phone.trim()) {
      showToast('⚠️ Name and phone are required.');
      return;
    }
    setIsSubmitting(true);
    const { name, email, phone, plan, classType, initialStatus } = addForm;
    const { ok, data } = await apiFetch('/bookings/admin', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email: email || 'walkin@theden.pk',
        phone,
        plan,
        classType,
        status: initialStatus,
      }),
    });
    setIsSubmitting(false);
    if (ok) {
      setAddForm({
        name: '', email: '', phone: '', plan: 'Standard', classType: 'Weight Training',
        initialStatus: 'confirmed',
      });
      setShowAddForm(false);
      showToast('✅ Walk-in client registered!');
      loadBookings();
    } else {
      showToast(data.message ? `⚠️ ${data.message}` : '⚠️ Failed to register client. Check backend + Supabase keys.');
    }
  };

  const exportCSV = () => {
    const header = 'Name,Email,Phone,Plan,Class,Status,Date,Cost(PKR)';
    const rows = bookings.map(b =>
      `"${b.name}","${b.email}","${b.phone}","${b.plan || ''}","${b.classType || ''}","${b.status}","${new Date(b.createdAt).toLocaleDateString()}",${b.cost || 0}`
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `den-bookings-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Bookings exported to CSV.');
  };

  // ── Stats (from current page data — for accurate stats fetch all separately) ──
  const totalRevenue  = bookings.filter(b => normalizeBookingStatus(b.status) === 'paid').reduce((s, b) => s + (b.cost || 0), 0);
  const pendingAmount = bookings.filter(b => normalizeBookingStatus(b.status) !== 'paid').reduce((s, b) => s + (b.cost || 0), 0);
  const paidCount     = bookings.filter(b => normalizeBookingStatus(b.status) === 'paid').length;

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-[#060608] text-zinc-100 font-sans antialiased">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-6 z-[999] bg-zinc-950 border border-zinc-800 text-white py-3 px-5 rounded-lg shadow-2xl flex items-center gap-3 text-sm">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          {toast}
        </div>
      )}

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
            <Dumbbell className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h1 className="font-black text-white text-sm uppercase tracking-widest">The Den</h1>
            <p className="text-zinc-600 text-[10px] uppercase tracking-wider">Admin Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Auto-logout timer */}
          <div className="hidden sm:flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
            <Clock className="w-3 h-3 text-zinc-500" />
            <span className="text-zinc-500 text-[10px] font-mono">{fmtTime(autoLogoutTimer)}</span>
          </div>

          {/* Admin badge */}
          {admin && (
            <div className="hidden sm:flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
              <Shield className="w-3 h-3 text-red-500" />
              <span className="text-zinc-400 text-[10px]">{admin.role}</span>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-400 hover:text-white text-xs transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* View switcher */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setAdminView('bookings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition ${
              adminView === 'bookings' ? 'bg-red-600 border-red-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
          >
            <BarChart2 className="w-4 h-4" /> Bookings
          </button>
          <button
            onClick={() => setAdminView('reviews')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition ${
              adminView === 'reviews' ? 'bg-red-600 border-red-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Member Reviews
          </button>
          <button
            onClick={() => setAdminView('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition ${
              adminView === 'settings' ? 'bg-red-600 border-red-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
          >
            <Settings className="w-4 h-4" /> WhatsApp & Site
          </button>
        </div>

        {adminView === 'settings' ? (
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 mb-8 max-w-lg">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-900">
              <Phone className="w-5 h-5 text-emerald-500" />
              <div>
                <h2 className="font-bold text-white text-sm uppercase tracking-wider">WhatsApp contact number</h2>
                <p className="text-zinc-500 text-xs mt-0.5">Used for chat button, booking checkout, and contact section</p>
              </div>
            </div>
            {settingsLoading ? (
              <div className="flex justify-center py-8"><Loader className="w-6 h-6 text-red-500 animate-spin" /></div>
            ) : (
              <form onSubmit={saveWhatsappSettings} className="space-y-4">
                {settingsError && (
                  <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
                    {settingsError}
                  </p>
                )}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1.5">WhatsApp number</label>
                  <input
                    type="tel"
                    value={whatsappSettings.whatsappNumber}
                    onChange={(e) => setWhatsappSettings((p) => ({ ...p, whatsappNumber: e.target.value }))}
                    placeholder="03169636282 or 923169636282"
                    className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono"
                  />
                  <p className="text-[10px] text-zinc-600 mt-1">
                    Saved as: {normalizeWhatsAppNumber(whatsappSettings.whatsappNumber) || '—'} (Pakistan 03xx or 92xx)
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1.5">Default chat message</label>
                  <textarea
                    rows={3}
                    value={whatsappSettings.whatsappPrefillMessage}
                    onChange={(e) => setWhatsappSettings((p) => ({ ...p, whatsappPrefillMessage: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider disabled:opacity-50"
                >
                  {settingsSaving ? 'Saving…' : 'Save WhatsApp settings'}
                </button>
              </form>
            )}
          </div>
        ) : adminView === 'reviews' ? (
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden mb-8">
            <div className="px-5 py-4 border-b border-zinc-900 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Star className="w-4 h-4 text-red-500" />
                <span className="font-bold text-white text-sm uppercase tracking-wider">Member reviews</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadReviews()}
                  disabled={reviewsLoading}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-bold uppercase hover:text-white disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${reviewsLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
                <select
                  value={reviewFilter}
                  onChange={(e) => setReviewFilter(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300"
                >
                  <option value="all">All ({reviewCounts.all})</option>
                  <option value="pending">Pending ({reviewCounts.pending})</option>
                  <option value="published">Published on homepage ({reviewCounts.published})</option>
                  <option value="approved">Approved (any)</option>
                  <option value="rejected">Rejected ({reviewCounts.rejected})</option>
                </select>
              </div>
            </div>
            <p className="px-5 py-2 text-[11px] text-zinc-500 border-b border-zinc-900/80">
              Approve a review to publish it on the homepage. Published reviews appear in the filter above and on the public site.
            </p>
            {reviewsError && (
              <p className="mx-5 mt-3 px-3 py-2 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 text-xs">
                {reviewsError}
              </p>
            )}
            {reviewsLoading ? (
              <div className="flex justify-center py-16"><Loader className="w-6 h-6 text-red-500 animate-spin" /></div>
            ) : reviews.length === 0 ? (
              <p className="text-center text-zinc-600 text-sm py-16">No reviews in this filter.</p>
            ) : (
              <div className="divide-y divide-zinc-900">
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className={`p-5 hover:bg-zinc-900/20 ${
                      r.moderationStatus === 'approved' && r.showOnWebsite
                        ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500'
                        : ''
                    }`}
                  >
                    <div className="flex flex-wrap justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-white text-sm">{r.memberName}</p>
                        <p className="text-xs text-zinc-500">{r.memberEmail}</p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                        r.moderationStatus === 'approved' && r.showOnWebsite
                          ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                          : r.moderationStatus === 'approved'
                            ? 'text-zinc-400 border-zinc-600/30 bg-zinc-800/50'
                          : r.moderationStatus === 'rejected' ? 'text-red-400 border-red-500/30 bg-red-500/10'
                          : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                      }`}>
                        {r.moderationStatus === 'approved' && r.showOnWebsite
                          ? 'Published on homepage'
                          : r.moderationStatus}
                      </span>
                    </div>
                    <div className="flex gap-0.5 text-yellow-500 mb-2">
                      {[...Array(r.rating)].map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
                    </div>
                    <p className="text-sm text-zinc-300 italic mb-2">&quot;{r.comment}&quot;</p>
                    <p className="text-[10px] text-zinc-500 uppercase mb-3">
                      Member review · {r.displayRole || '—'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {r.moderationStatus !== 'approved' && (
                        <button
                          onClick={() => moderateReview(r.id, 'approved')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase"
                        >
                          <Globe className="w-3.5 h-3.5" /> Publish to homepage
                        </button>
                      )}
                      {r.moderationStatus === 'approved' && (
                        <button
                          onClick={() => unpublishReview(r.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-bold uppercase"
                        >
                          <EyeOff className="w-3.5 h-3.5" /> Unpublish
                        </button>
                      )}
                      {r.moderationStatus !== 'rejected' && (
                        <button
                          onClick={() => moderateReview(r.id, 'rejected')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-bold uppercase"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      )}
                      <button
                        onClick={() => openEditReview(r)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px] font-bold uppercase"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => deleteReview(r.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-950/30 border border-red-900/40 text-red-400 text-[10px] font-bold uppercase"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {editingReview && (
              <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-white text-sm uppercase">Edit review</h3>
                    <button onClick={() => setEditingReview(null)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  <form onSubmit={saveEditReview} className="space-y-3 text-left">
                    <div>
                      <label className="text-[10px] uppercase text-zinc-500 font-bold">Rating</label>
                      <select
                        value={editReviewForm.rating}
                        onChange={(e) => setEditReviewForm((p) => ({ ...p, rating: Number(e.target.value) }))}
                        className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white"
                      >
                        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-zinc-500 font-bold">Subtitle</label>
                      <input
                        value={editReviewForm.displayRole}
                        onChange={(e) => setEditReviewForm((p) => ({ ...p, displayRole: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-zinc-500 font-bold">Comment</label>
                      <textarea
                        rows={4}
                        value={editReviewForm.comment}
                        onChange={(e) => setEditReviewForm((p) => ({ ...p, comment: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white resize-none"
                      />
                    </div>
                    <button type="submit" className="w-full py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-xs font-bold uppercase">
                      Save changes
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        ) : (
        <>
        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users,       label: 'Total Bookings', value: totalCount,  sub: 'all time' },
            { icon: DollarSign,  label: 'Revenue (PKR)',  value: `₨${(totalRevenue/1000).toFixed(1)}k`, sub: 'from paid' },
            { icon: TrendingUp,  label: 'Pending (PKR)',  value: `₨${(pendingAmount/1000).toFixed(1)}k`, sub: 'awaiting payment' },
            { icon: CheckCircle2,label: 'Paid Clients',   value: paidCount,   sub: 'this page' },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="bg-zinc-950 border border-zinc-900 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-500 text-[10px] uppercase tracking-widest">{label}</span>
                <Icon className="w-4 h-4 text-red-500/50" />
              </div>
              <div className="text-2xl font-black text-white">{value}</div>
              <div className="text-zinc-600 text-[10px] mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              type="text"
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-red-500/60 transition"
            />
          </div>

          {/* Plan filter */}
          <select
            value={filterPlan}
            onChange={(e) => { setFilterPlan(e.target.value); setPage(1); }}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-red-500/60 transition"
          >
            <option value="all">All Plans</option>
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-red-500/60 transition"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="paid">Paid</option>
          </select>

          {/* Action buttons */}
          <button onClick={loadBookings} className="p-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg text-zinc-400 hover:text-white transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg text-zinc-400 hover:text-white text-xs transition">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-xs font-bold uppercase tracking-wider transition"
          >
            <Plus className="w-4 h-4" />
            <span>Walk-in</span>
          </button>
        </div>

        {/* ── Add Walk-in Modal ── */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Register Walk-in Client</h3>
                <button onClick={() => setShowAddForm(false)} className="text-zinc-600 hover:text-white transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddSubmit} className="space-y-4">
                {[
                  { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'Client full name' },
                  { label: 'Phone *', key: 'phone', type: 'tel', placeholder: '03XX-XXXXXXX' },
                  { label: 'Email', key: 'email', type: 'email', placeholder: 'Optional' },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label className="block text-zinc-500 text-[10px] uppercase tracking-wider mb-1.5">{label}</label>
                    <input
                      type={type}
                      value={addForm[key]}
                      onChange={(e) => setAddForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-red-500/60 transition"
                    />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-500 text-[10px] uppercase tracking-wider mb-1.5">Plan</label>
                    <select
                      value={addForm.plan}
                      onChange={(e) => setAddForm(p => ({ ...p, plan: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-red-500/60 transition"
                    >
                      <option>Basic</option>
                      <option>Standard</option>
                      <option>Premium</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-500 text-[10px] uppercase tracking-wider mb-1.5">Class</label>
                    <select
                      value={addForm.classType}
                      onChange={(e) => setAddForm(p => ({ ...p, classType: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-red-500/60 transition"
                    >
                      <option>Weight Training</option>
                      <option>Cardio Training</option>
                      <option>Strength Programs</option>
                      <option>Personal Training</option>
                      <option>Yoga</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-zinc-500 text-[10px] uppercase tracking-wider mb-1.5">Payment status</label>
                  <select
                    value={addForm.initialStatus}
                    onChange={(e) => setAddForm(p => ({ ...p, initialStatus: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-red-500/60 transition"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddForm(false)}
                    className="flex-1 py-2.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white text-sm transition">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting}
                    className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
                    {isSubmitting ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Register
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Bookings Table ── */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart2 className="w-4 h-4 text-red-500" />
              <span className="font-bold text-white text-sm uppercase tracking-wider">Client Bookings</span>
            </div>
            <span className="text-zinc-600 text-xs">{totalCount} total</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader className="w-6 h-6 text-red-500 animate-spin" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
              <Users className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-sm">No bookings found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-900">
                    {['Client', 'Contact', 'Plan', 'Class', 'Status', 'Cost', 'Date', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-b border-zinc-900/50 hover:bg-zinc-900/30 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white text-sm">{b.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-zinc-400 text-xs flex items-center gap-1"><Mail className="w-3 h-3" />{b.email}</div>
                        <div className="text-zinc-500 text-xs flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{b.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-zinc-300">{b.plan || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-500">{b.classType || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleStatus(b)}
                          title="Click: Pending → Confirmed → Paid"
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full transition hover:opacity-80 ${STATUS_STYLES[normalizeBookingStatus(b.status)]}`}
                        >
                          {statusDisplayLabel(b.status)}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-zinc-300 font-mono">₨{(b.cost || 0).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-zinc-600 text-xs">
                          <Calendar className="w-3 h-3" />
                          {new Date(b.createdAt).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteBooking(b.id)}
                          className="p-1.5 text-zinc-700 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-900">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 disabled:opacity-40 hover:text-white transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <span className="text-zinc-600 text-xs">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 disabled:opacity-40 hover:text-white transition"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        </>
        )}

      </main>
    </div>
  );
}
