import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '/api';
import {
  Dumbbell, Flame, Trophy, Shield, Clock, Users, Award, 
  ChevronRight, ChevronDown, Check, Phone, MapPin, 
  Mail, Calendar, MessageCircle, X, ChevronLeft, 
  Menu, Star, ArrowUpRight, Grid, Image as ImageIcon, Info, DollarSign,
  Heart, Send, CheckCircle2, AlertCircle, Settings, BarChart2, Eye, Compass,
  Sparkles, ShieldAlert, Zap, Target, Activity, Plus, Trash2, Edit, Printer, FileText,
  User, UserCheck, LogOut, Loader
} from 'lucide-react';
import { attemptSignup, attemptUserLogin, isUserAuthenticated, userLogout, getActiveUser } from './userAuth';
import { fetchPublicTestimonials } from './profileApi';
import { fetchPublicSettings, buildWhatsAppUrl } from './siteApi';

export default function App() {
  const location = useLocation();
  // Navigation & Scroll State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isSticky, setIsSticky] = useState(false);

  // Gallery Filter & Lightbox State
  const [galleryFilter, setGalleryFilter] = useState('all');
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Testimonial Slider State
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState(null);

  // Developer / Demo Mode Hidden Access Controls
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);

  // Regular User Auth State
  const [currentUser, setCurrentUser] = useState(null);
  const [userAuthOpen, setUserAuthOpen] = useState(false);
  const [userAuthMode, setUserAuthMode] = useState('login'); // 'login' or 'signup'
  const [userAuthName, setUserAuthName] = useState('');
  const [userAuthEmail, setUserAuthEmail] = useState('');
  const [userAuthPassword, setUserAuthPassword] = useState('');
  const [userAuthError, setUserAuthError] = useState(null);
  const [userAuthLoading, setUserAuthLoading] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Booking System State
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('Standard');
  const [bookingStep, setBookingStep] = useState(1);
  const [bookingForm, setBookingForm] = useState({
    name: '',
    email: '',
    phone: '',
    classType: 'Weight Training',
    timeSlot: 'Morning (06:00 AM - 12:00 PM)',
    comments: ''
  });
  const [bookingErrors, setBookingErrors] = useState({});

  // Bookings state (used only for demo admin view — real data lives in Supabase)
  const [bookingsList, setBookingsList] = useState([]);

  // Offline manual booker panel (inside admin view)
  const [showOfflineBooker, setShowOfflineBooker] = useState(false);
  const [offlineForm, setOfflineForm] = useState({
    name: '',
    email: '',
    phone: '',
    plan: 'Standard',
    classType: 'Weight Training',
    status: 'Paid'
  });

  // Search & Filter inside Admin Dashboard
  const [adminSearch, setAdminSearch] = useState('');
  const [adminFilterPlan, setAdminFilterPlan] = useState('all');

  // General Contact Form State
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactErrors, setContactErrors] = useState({});

  // Floating WhatsApp Drawer State
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState('');

  // Demo Control Panel State 
  const [demoOpen, setDemoOpen] = useState(false);
  const [themeAccent, setThemeAccent] = useState('red'); // red, gold, emerald, cyan
  const [showDemoNotification, setShowDemoNotification] = useState(true);

  // Back-to-Top Button
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Counters State (for simulated dynamic counting)
  const [counters, setCounters] = useState({ members: 0, trainers: 0, rate: 0 });

  // Sound effects / visual feedback simulator
  const [toastMessage, setToastMessage] = useState(null);
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Check URL parameters for Admin/Demo access
  useEffect(() => {
    const checkUrlParams = () => {
      const hasDemoParam = 
        window.location.search.includes('demo=true') || 
        window.location.search.includes('admin=true') || 
        window.location.hash === '#demo' || 
        window.location.hash === '#admin';
      
      if (hasDemoParam) {
        setIsAdminMode(true);
        triggerToast("🔑 Developer Pitch Mode Enabled! Customize panel unlocked.");
      }
    };
    checkUrlParams();
    window.addEventListener('hashchange', checkUrlParams);
    return () => window.removeEventListener('hashchange', checkUrlParams);
  }, []);

  // Check active user session on mount (HttpOnly cookie stays alive across refreshes)
  useEffect(() => {
    (async () => {
      const authed = await isUserAuthenticated();
      if (authed) setCurrentUser(getActiveUser());
    })();
  }, []);

  // Smooth scroll to hash on location changes
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        const timer = setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [location.hash]);

  // Close user dropdown when clicking outside
  useEffect(() => {
    if (!userDropdownOpen) return;
    const handler = () => setUserDropdownOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [userDropdownOpen]);

  // ── User auth handlers ───────────────────────────────────────────────────────
  const handleUserLogin = async (e) => {
    e.preventDefault();
    if (!userAuthEmail || !userAuthPassword) {
      setUserAuthError('Email and password are required');
      return;
    }
    setUserAuthLoading(true);
    setUserAuthError(null);
    const res = await attemptUserLogin(userAuthEmail, userAuthPassword);
    setUserAuthLoading(false);
    if (res.success) {
      setCurrentUser(res.user);
      setUserAuthOpen(false);
      setUserAuthEmail('');
      setUserAuthPassword('');
      triggerToast(`👋 Welcome back, ${res.user.name}!`);
    } else {
      setUserAuthError(res.error || 'Invalid email or password');
    }
  };

  const handleUserSignup = async (e) => {
    e.preventDefault();
    if (!userAuthName || !userAuthEmail || !userAuthPassword) {
      setUserAuthError('All fields are required');
      return;
    }
    setUserAuthLoading(true);
    setUserAuthError(null);
    const res = await attemptSignup(userAuthName, userAuthEmail, userAuthPassword);
    setUserAuthLoading(false);
    if (res.success) {
      setUserAuthMode('login');
      setUserAuthPassword('');
      setUserAuthError(null);
      triggerToast('🎉 Account created! Please log in to continue.');
    } else {
      setUserAuthError(res.error || 'Signup failed');
    }
  };

  const handleUserLogout = async () => {
    await userLogout();
    setCurrentUser(null);
    setUserDropdownOpen(false);
    triggerToast('🔒 Logged out successfully');
  };

  // Handle Logo / Copyright click Easter Egg to activate pitch options
  const handleEasterEggClick = () => {
    const clicks = logoClicks + 1;
    setLogoClicks(clicks);
    if (clicks >= 5) {
      setIsAdminMode(true);
      setDemoOpen(true);
      triggerToast("🔐 Admin Developer Console Unlocked!");
      setLogoClicks(0);
    } else {
      triggerToast(`🔑 Click ${5 - clicks} more times to unlock admin pitch tools.`);
    }
  };

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      // Sticky header
      if (window.scrollY > 40) {
        setIsSticky(true);
      } else {
        setIsSticky(false);
      }

      // Scroll progress
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        setScrollProgress((window.scrollY / totalScroll) * 100);
      }

      // Back to top
      if (window.scrollY > 500) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Animate stats counter numbers upon mounting
  useEffect(() => {
    const targetMembers = 1540;
    const targetTrainers = 18;
    const targetRate = 99;

    let start = 0;
    const duration = 1800;
    const stepTime = 25;
    const totalSteps = duration / stepTime;

    const interval = setInterval(() => {
      start++;
      setCounters({
        members: Math.min(Math.floor((start / totalSteps) * targetMembers), targetMembers),
        trainers: Math.min(Math.floor((start / totalSteps) * targetTrainers), targetTrainers),
        rate: Math.min(Math.floor((start / totalSteps) * targetRate), targetRate),
      });

      if (start >= totalSteps) {
        clearInterval(interval);
      }
    }, stepTime);

    return () => clearInterval(interval);
  }, []);

  // Theme Accent Color mapping
  const accentColors = {
    red: {
      primary: 'text-red-500',
      primaryHover: 'hover:text-red-400',
      bg: 'bg-red-500',
      bgHover: 'hover:bg-red-600',
      border: 'border-red-500',
      borderHover: 'hover:border-red-400',
      gradient: 'from-red-500 to-rose-600',
      accentGlow: 'shadow-red-500/20',
      glowBorder: 'border-red-500/40 focus:border-red-500',
      textGradient: 'bg-gradient-to-r from-red-500 to-rose-600 bg-clip-text text-transparent',
      ring: 'focus:ring-red-500',
      badge: 'bg-red-500/10 text-red-400 border-red-500/20'
    },
    gold: {
      primary: 'text-amber-500',
      primaryHover: 'hover:text-amber-400',
      bg: 'bg-amber-500',
      bgHover: 'hover:bg-amber-600',
      border: 'border-amber-500',
      borderHover: 'hover:border-amber-400',
      gradient: 'from-amber-500 to-yellow-600',
      accentGlow: 'shadow-amber-500/20',
      glowBorder: 'border-amber-500/40 focus:border-amber-500',
      textGradient: 'bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent',
      ring: 'focus:ring-amber-500',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    },
    emerald: {
      primary: 'text-emerald-500',
      primaryHover: 'hover:text-emerald-400',
      bg: 'bg-emerald-500',
      bgHover: 'hover:bg-emerald-600',
      border: 'border-emerald-500',
      borderHover: 'hover:border-emerald-400',
      gradient: 'from-emerald-500 to-teal-600',
      accentGlow: 'shadow-emerald-500/20',
      glowBorder: 'border-emerald-500/40 focus:border-emerald-500',
      textGradient: 'bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent',
      ring: 'focus:ring-emerald-500',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    },
    cyan: {
      primary: 'text-cyan-400',
      primaryHover: 'hover:text-cyan-300',
      bg: 'bg-cyan-500',
      bgHover: 'hover:bg-cyan-600',
      border: 'border-cyan-400',
      borderHover: 'hover:border-cyan-300',
      gradient: 'from-cyan-400 to-blue-600',
      accentGlow: 'shadow-cyan-400/20',
      glowBorder: 'border-cyan-400/40 focus:border-cyan-400',
      textGradient: 'bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent',
      ring: 'focus:ring-cyan-400',
      badge: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20'
    }
  };

  const activeColor = accentColors[themeAccent];

  const defaultTestimonials = [
    {
      name: 'Mohammad Hamza',
      role: 'Powerlifter & Competitor',
      rating: 5,
      comment: 'The Den has completely redefined my training. The customized heavy machinery is unmatched in Peshawar. The biomechanics of the plate-loaded presses hits target fibers perfectly. Elite standard!',
      img: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=150&h=150&q=80'
    },
    {
      name: 'Dr. Ayesha Malik',
      role: 'Consultant Physiotherapist',
      rating: 5,
      comment: 'Finding a workout space focused on anatomical alignment and structural mechanics was critical. The Den surpasses all expectations. Their equipment enables premium torque angles.',
      img: 'https://images.unsplash.com/photo-1548690312-e3b507d8c110?auto=format&fit=crop&w=150&h=150&q=80'
    },
    {
      name: 'Shahbaz Khattak',
      role: 'Corporate Executive',
      rating: 5,
      comment: 'Outstanding evening slots and highly supportive personnel. The elite environment keeps you locked in and focused. Standard rate package is highly cost-effective for this tier of service.',
      img: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=150&h=150&q=80'
    }
  ];

  const [testimonials, setTestimonials] = useState(defaultTestimonials);
  const [siteSettings, setSiteSettings] = useState({
    whatsappNumber: '923169636282',
    whatsappDisplay: '03169636282',
    whatsappPrefillMessage:
      import.meta.env.VITE_WHATSAPP_PREFILLED_MSG ||
      'Assalam-o-Alaikum, I want to book an elite trial workout pass at The Den Gym!',
  });

  useEffect(() => {
    fetchPublicSettings().then((res) => {
      if (res.success) setSiteSettings(res);
    });
    fetchPublicTestimonials().then((res) => {
      if (res.success && res.testimonials.length > 0) {
        setTestimonials(res.testimonials);
        setCurrentTestimonial(0);
      }
    });
  }, []);

  // Service list
  const services = [
    {
      id: 'weight-training',
      title: 'Weight Training',
      desc: 'Build functional mass using custom plate-loaded biomechanics, specialized platforms, and structural progression guides.',
      icon: Dumbbell,
      badge: 'Strength Focus',
      img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'cardio-training',
      title: 'Cardio Training',
      desc: 'Shred body fat and increase metabolic thresholds using specialized air-bikes, rowers, and dynamic interval trainers.',
      icon: Flame,
      badge: 'Stamina Focus',
      img: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'personal-training',
      title: 'Personal Training',
      desc: 'Accelerate physical objectives with dedicated 1-on-1 coaching, custom kinetic profiling, and dynamic diet templates.',
      icon: Trophy,
      badge: '1-on-1 Elite',
      img: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'strength-programs',
      title: 'Strength Programs',
      desc: 'Targeted powerlifting, weightlifting, and sports performance protocols designed to maximize absolute motor output.',
      icon: Shield,
      badge: 'Peak Performance',
      img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'fat-loss-programs',
      title: 'Fat Loss Programs',
      desc: 'Scientific, high-intensity workouts paired with precise metabolic nutrition templates designed to strip body fat.',
      icon: Award,
      badge: 'Targeted Shredding',
      img: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'fitness-coaching',
      title: 'Fitness Coaching',
      desc: 'A comprehensive approach combining posture correction, mobility programming, and sustainable physical habit adjustments.',
      icon: Clock,
      badge: 'Holistic Health',
      img: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=600&q=80'
    }
  ];

  // Gallery array
  const galleryItems = [
    { id: 1, type: 'strength', title: 'Heavy Dumbbell Bay', img: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80' },
    { id: 2, type: 'cardio', title: 'Advanced Endurance Deck', img: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80' },
    { id: 3, type: 'personal', title: '1-on-1 Boxing Training', img: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=800&q=80' },
    { id: 4, type: 'interior', title: 'High-End Plate Loaded Machinery', img: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=800&q=80' },
    { id: 5, type: 'interior', title: 'Premium Lockers & Grooming Bay', img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80' },
    { id: 6, type: 'classes', title: 'High-Octane Group Aerobics', img: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=800&q=80' }
  ];

  const filteredGallery = galleryFilter === 'all' 
    ? galleryItems 
    : galleryItems.filter(item => item.type === galleryFilter);

  // Accordion FAQs Array
  const faqs = [
    {
      q: 'What are the timing slots at The Den Fitness Gym Peshawar?',
      a: 'We are open from Monday through Saturday, from 6:00 AM to 10:30 PM. We are closed on Sundays to allow deep cleaning and maintenance of the elite heavy machines.'
    },
    {
      q: 'Do you offer personal trainers for female members?',
      a: 'Yes! We have dedicated certified trainers and nutritionists. We offer safe, private training modules and high-quality coaching geared specifically towards your personalized health goals.'
    },
    {
      q: 'Can I schedule a one-day trial session before joining?',
      a: 'Absolutely! You can book a trial class online using our instant booking system or call us directly. We will prepare your visitor pass and match you with a coach for a 1-on-1 overview.'
    },
    {
      q: 'What equipment do you have at the Nasir Bagh Road facility?',
      a: 'We are equipped with elite gym equipment, including massive plate-loaded hammer strengths, premium multi-pulley cable arrays, dedicated Olympic lifting platforms, Dumbbells up to 60kg, specialized skill-mills, smart treadmills, and rowing stations.'
    },
    {
      q: 'Are custom dietary and nutrition charts included in standard packages?',
      a: 'Yes, basic macro guidance is included in our Standard plan, while highly specialized premium ketogenic, high-carb refeed, powerlifting dietary, and athletic lifestyle meal prep charts are fully managed in the Premium tier.'
    }
  ];

  // Next / Prev Testimonial navigation
  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };
  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  useEffect(() => {
    if (currentTestimonial >= testimonials.length) {
      setCurrentTestimonial(0);
    }
  }, [testimonials.length, currentTestimonial]);

  // Gallery lightbox navigation
  const nextLightbox = () => {
    setLightboxIndex((prev) => (prev + 1) % filteredGallery.length);
  };
  const prevLightbox = () => {
    setLightboxIndex((prev) => (prev - 1 + filteredGallery.length) % filteredGallery.length);
  };

  // Form Validation Handlers
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!bookingForm.name.trim()) errors.name = 'FullName is required';
    if (!bookingForm.email.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/)) errors.email = 'Provide a valid Email';
    if (!bookingForm.phone.match(/^03\d{9}$/) && !bookingForm.phone.match(/^\+923\d{9}$/)) {
      errors.phone = 'Use format: 03169636282';
    }

    if (Object.keys(errors).length > 0) {
      setBookingErrors(errors);
      triggerToast('⚠️ Form error details detected.');
      return;
    }

    setBookingErrors({});
    try {
      const res = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bookingForm.name,
          email: bookingForm.email,
          phone: bookingForm.phone,
          plan: selectedPlan,
          classType: bookingForm.classType,
          timeSlot: bookingForm.timeSlot,
          comments: bookingForm.comments,
        }),
      });
      if (res.ok) {
        setBookingStep(2);
        triggerToast('🎉 Booking registered! Finalize payment via WhatsApp.');
      } else {
        const data = await res.json().catch(() => ({}));
        triggerToast(`⚠️ ${data.message || 'Booking failed. Please try again.'}`);
      }
    } catch {
      triggerToast('⚠️ Connection error. Please try again or call us directly.');
    }
  };

  // Manual Offline Booker Submission (Admin panel action)
  const handleOfflineBookingSubmit = (e) => {
    e.preventDefault();
    if (!offlineForm.name.trim() || !offlineForm.phone.trim()) {
      triggerToast("⚠️ Name and Phone are required for offline register!");
      return;
    }
    const planPrices = { Basic: 5000, Standard: 8000, Premium: 12000 };
    const cost = planPrices[offlineForm.plan] || 8000;

    const newBooking = {
      id: Date.now(),
      name: offlineForm.name,
      email: offlineForm.email || 'offline@theden.com',
      phone: offlineForm.phone,
      plan: offlineForm.plan,
      status: offlineForm.status,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      classType: offlineForm.classType,
      cost: cost
    };

    setBookingsList([newBooking, ...bookingsList]);
    setOfflineForm({
      name: '',
      email: '',
      phone: '',
      plan: 'Standard',
      classType: 'Weight Training',
      status: 'Paid'
    });
    setShowOfflineBooker(false);
    triggerToast("✅ Registered walk-in client successfully!");
  };

  // Toggle booking status inside Admin Dashboard (Paid ➔ Pending ➔ Confirmed)
  const toggleBookingStatus = (id, currentStatus) => {
    const statusSequence = { 'Pending': 'Confirmed', 'Confirmed': 'Paid', 'Paid': 'Pending' };
    const nextStatus = statusSequence[currentStatus] || 'Pending';
    
    setBookingsList(bookingsList.map(bk => {
      if (bk.id === id) {
        return { ...bk, status: nextStatus };
      }
      return bk;
    }));
    triggerToast(`⚡ Status updated to: ${nextStatus}`);
  };

  // Delete a booking from persistent ledger (Admin option)
  const deleteBooking = (id) => {
    if (window.confirm("Are you sure you want to remove this booking permanently?")) {
      setBookingsList(bookingsList.filter(bk => bk.id !== id));
      triggerToast("🗑️ Booking deleted from ledger.");
    }
  };

  // Format Direct WhatsApp Checkout Redirect
  const generateWhatsAppCheckoutUrl = () => {
    const planPrices = { Basic: 5000, Standard: 8000, Premium: 12000 };
    const cost = planPrices[selectedPlan] || 8000;

    const now = new Date();
    const bookingDate = now.toLocaleDateString('en-PK', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const bookingTime = now.toLocaleTimeString('en-PK', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const textMessage = [
      `Assalam-o-Alaikum! My name is ${bookingForm.name}. I just registered on your website for the *${selectedPlan} Plan* (PKR ${cost.toLocaleString()}) for *${bookingForm.classType}* slots. Please activate my membership class pass!`,
      ``,
      `*Details:*`,
      `* Phone: ${bookingForm.phone}`,
      `* Preference: ${bookingForm.timeSlot}`,
      bookingForm.email ? `* Email: ${bookingForm.email}` : null,
      bookingForm.comments ? `* Additional Notes: ${bookingForm.comments}` : null,
      ``,
      `📅 *REGISTRATION INFO*`,
      `• Date: ${bookingDate}`,
      `• Time: ${bookingTime}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `✅ Kindly confirm my membership and guide me about the *payment process* and *first class schedule*.`,
      ``,
      `Thank you! 🙏`,
    ].filter(line => line !== null).join('\n');

    return buildWhatsAppUrl(siteSettings.whatsappNumber, textMessage);
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!contactForm.name.trim()) errors.name = 'Your name is required';
    if (!contactForm.email.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/)) errors.email = 'Valid email is required';
    if (!contactForm.message.trim() || contactForm.message.length < 10) errors.message = 'Must be at least 10 letters';

    if (Object.keys(errors).length > 0) {
      setContactErrors(errors);
      return;
    }

    setContactErrors({});
    try {
      const res = await fetch(`${API_URL}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactForm.name,
          email: contactForm.email,
          subject: contactForm.subject,
          message: contactForm.message,
          website: '', // Honeypot — humans leave this empty, bots fill it
        }),
      });
      // Always show success (even if server rejects as spam — don't reveal honeypot)
      setContactSubmitted(true);
      triggerToast('🚀 Received! We will WhatsApp you shortly.');
      setTimeout(() => {
        setContactForm({ name: '', email: '', subject: '', message: '' });
        setContactSubmitted(false);
      }, 5000);
    } catch {
      triggerToast('⚠️ Connection error. Please try WhatsApp instead.');
    }
  };

  // Launch WhatsApp Message
  const triggerWhatsApp = () => {
    const msg = whatsappMsg || siteSettings.whatsappPrefillMessage;
    window.open(buildWhatsAppUrl(siteSettings.whatsappNumber, msg), '_blank');
    setWhatsappOpen(false);
    setWhatsappMsg('');
  };

  // Handle plan select from pricing section
  const openBookingWithPlan = (planName) => {
    if (!currentUser) {
      // User must be logged in to book a class — prompt login
      setUserAuthMode('login');
      setUserAuthOpen(true);
      triggerToast('🔒 Please sign in to your Member Portal to book a class pass.');
      return;
    }
    setSelectedPlan(planName);
    setBookingStep(1);
    // Pre-fill name & email from logged-in user
    setBookingForm(prev => ({
      ...prev,
      name: currentUser.name || prev.name,
      email: currentUser.email || prev.email,
    }));
    setBookingOpen(true);
  };

  // Filtered Bookings for the Admin View
  const filteredBookingsForAdmin = bookingsList.filter(bk => {
    const matchesSearch = bk.name.toLowerCase().includes(adminSearch.toLowerCase()) || bk.phone.includes(adminSearch);
    const matchesFilter = adminFilterPlan === 'all' || bk.plan.toLowerCase() === adminFilterPlan.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  // Calculate live financial statistics
  const totalRevenue = bookingsList
    .filter(bk => bk.status === 'Paid')
    .reduce((sum, bk) => sum + (bk.cost || 0), 0);

  const pendingRevenue = bookingsList
    .filter(bk => bk.status !== 'Paid')
    .reduce((sum, bk) => sum + (bk.cost || 0), 0);

  return (
    <div className="bg-[#050505] text-zinc-100 min-h-screen relative font-sans antialiased selection:bg-red-500 selection:text-white">
      
      {/* Scroll Progress Bar */}
      <div className="scroll-progress animate-pulse" style={{ width: `${scrollProgress}%` }} />

      {/* 🔐 SYSTEM DEVELOPER Pitch Greeting Banner (Hidden to regular users, shown only when demo/admin is active in url) */}
      {isAdminMode && showDemoNotification && (
        <div className="bg-gradient-to-r from-red-700 via-rose-600 to-orange-600 text-white py-2.5 px-4 text-center text-xs sm:text-sm font-semibold flex items-center justify-between transition-all duration-500 z-50 sticky top-0 shadow-xl">
          <div className="mx-auto flex items-center gap-2">
            <Sparkles className="w-4 h-4 animate-bounce" />
            <span>👋 <b>Developer Pitch Mode Active:</b> Floating settings icon is now unlocked on the bottom right! Use it to switch accent colors and view ledger bookings.</span>
          </div>
          <button onClick={() => setShowDemoNotification(false)} className="hover:opacity-75 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* DYNAMIC TOAST SYSTEM */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-[999] glass-panel border border-zinc-850 bg-zinc-950/95 text-white py-3 px-5 rounded-lg shadow-2xl animate-slideUp flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${activeColor.bg} animate-ping`} />
          <span className="text-xs sm:text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* ----------------- STICKY NAVBAR ----------------- */}
      <header className={`fixed ${isAdminMode && showDemoNotification ? 'top-10' : 'top-0'} left-0 right-0 z-40 transition-all duration-300 ${isSticky ? 'bg-black/80 backdrop-blur-xl border-b border-zinc-900/60 py-3 shadow-lg' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          
          {/* Logo with Modern Icon */}
          <a href="#hero" className="flex items-center gap-2 group">
            <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 transition-all group-hover:border-red-500/50 flex items-center justify-center">
              <Dumbbell className={`w-5 h-5 ${activeColor.primary} transition-transform group-hover:rotate-45`} />
            </div>
            <span className="font-display font-extrabold text-2xl tracking-tighter text-white">
              THE <span className={`${activeColor.primary} transition-colors`}>DEN</span>
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {['about', 'services', 'plans', 'trainers', 'gallery', 'faqs', 'contact'].map((sect) => (
              <a 
                key={sect}
                href={`/#${sect}`} 
                className="text-zinc-400 hover:text-white transition font-semibold text-xs tracking-widest uppercase relative py-1.5 group overflow-hidden"
              >
                {sect === 'plans' ? 'Plans' : sect === 'faqs' ? 'FAQs' : sect.replace('-', ' ')}
                <span className={`absolute bottom-0 left-0 w-full h-[2px] ${activeColor.bg} -translate-x-[102%] group-hover:translate-x-0 transition-transform duration-350`} />
              </a>
            ))}
          </nav>

          {/* Nav CTA Button */}
          <div className="hidden md:flex items-center gap-5">
            <a href="tel:03169636282" className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition font-bold text-xs uppercase tracking-wider">
              <Phone className="w-3.5 h-3.5 text-zinc-500" /> 03169636282
            </a>
            
            {/* Member Portal Button / Dropdown */}
            {currentUser ? (
              <div className="relative">
                <button
                  id="user-dropdown-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserDropdownOpen(!userDropdownOpen);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:text-white text-zinc-350 transition active:scale-95 shadow-lg"
                >
                  <UserCheck className={`w-3.5 h-3.5 ${activeColor.primary}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[120px]">{currentUser.name}</span>
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                </button>
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-zinc-950 border border-zinc-850 p-2 shadow-2xl z-50 animate-fadeIn text-left">
                    <div className="px-3 py-2 border-b border-zinc-905">
                      <p className="text-[9px] uppercase text-zinc-550 tracking-wider">Signed in as</p>
                      <p className="text-xs font-bold text-white truncate">{currentUser.email}</p>
                    </div>
                    <Link
                      to="/profile"
                      className="w-full mt-1 flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-lg transition text-left"
                    >
                      <User className="w-3.5 h-3.5 text-red-500" />
                      View Profile
                    </Link>
                    <button
                      onClick={handleUserLogout}
                      className="w-full mt-1 flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-red-400 hover:bg-zinc-900 rounded-lg transition text-left"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  setUserAuthMode('login');
                  setUserAuthOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-zinc-905 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-750 text-zinc-350 hover:text-white font-extrabold text-[10px] uppercase tracking-widest transition-all"
              >
                <User className="w-3.5 h-3.5" />
                Member Portal
              </button>
            )}

            <button 
              onClick={() => openBookingWithPlan('Standard')}
              className={`px-5 py-2.5 rounded-full ${activeColor.bg} text-white font-extrabold text-[10px] uppercase tracking-widest transition-all ${activeColor.bgHover} active:scale-95 shadow-xl ${activeColor.accentGlow}`}
            >
              Book Class Pass
            </button>
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
              <a href="tel:03169636282" className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-bold text-xs uppercase tracking-wider">
                <Phone className="w-4 h-4 text-emerald-500" /> Call Desk
              </a>

              {/* Mobile Member Portal */}
              {currentUser ? (
                <div className="flex flex-col gap-2 p-2.5 bg-zinc-900/50 rounded-lg border border-zinc-800 text-left">
                  <div className="flex items-center gap-2 px-1 py-0.5 border-b border-zinc-850 pb-1.5 mb-1">
                    <UserCheck className={`w-4 h-4 ${activeColor.primary}`} />
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase text-zinc-550 font-bold tracking-wider">Logged In</p>
                      <p className="text-xs font-bold text-zinc-200 truncate">{currentUser.name}</p>
                    </div>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider transition text-center"
                  >
                    <User className="w-3.5 h-3.5 text-red-500" /> View Profile
                  </Link>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleUserLogout();
                    }}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded bg-red-950/20 hover:bg-red-950/35 border border-red-900/30 text-red-400 font-bold text-xs uppercase tracking-wider transition"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setUserAuthMode('login');
                    setUserAuthOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-white font-bold text-xs uppercase tracking-wider transition"
                >
                  <User className="w-4 h-4" /> Member Portal
                </button>
              )}

              <button 
                onClick={() => { setIsMenuOpen(false); openBookingWithPlan('Standard'); }}
                className={`w-full py-3.5 rounded-lg ${activeColor.bg} text-white font-bold text-xs uppercase tracking-widest transition ${activeColor.bgHover}`}
              >
                Book Class Pass
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ----------------- 1. HERO SECTION ----------------- */}
      <section id="hero" className="relative min-h-screen flex items-center justify-center pt-32 pb-20 overflow-hidden">
        {/* Background Atmosphere Overlay */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/75 to-[#050505]/30 z-10" />
          <div className="absolute inset-0 bg-radial-gradient from-zinc-900 via-transparent to-transparent opacity-80 z-10" />
          <img 
            src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1920&q=80" 
            alt="The Den Gym Atmosphere" 
            className="w-full h-full object-cover object-center filter brightness-[0.25] scale-105" 
          />
        </div>

        {/* Hero Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-20 text-center flex flex-col items-center">
          
          {/* Tagline / Badge */}
          <div className="inline-flex items-center gap-2 px-4.5 py-2 rounded-full glass-panel border border-zinc-800/80 text-zinc-300 text-xs font-semibold mb-6 shadow-2xl">
            <span className={`w-2 h-2 rounded-full ${activeColor.bg} animate-pulse`} />
            📍 Peshawar's Elite Fitness Destination
          </div>

          {/* Slogan Headings */}
          <h1 className="font-display font-black text-5xl sm:text-7xl lg:text-[7.5rem] text-white tracking-tighter uppercase leading-[0.9] mb-4 select-none">
            FORGE YOUR<br />
            <span className="text-stroke-white text-zinc-950 font-black">ULTIMATE</span>{' '}
            <span className={`${activeColor.primary} transition-colors drop-shadow-[0_4px_12px_rgba(239,68,68,0.1)]`}>SELF</span>
          </h1>

          {/* Description */}
          <p className="max-w-2xl text-zinc-400 text-sm sm:text-lg leading-relaxed mb-10">
            Unleash physical potential at Peshawar's premier high-performance arena. Built for elite strength progression, biomechanical conditioning, and optimized metabolic coaching.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <button 
              onClick={() => openBookingWithPlan('Premium')}
              className={`w-full sm:w-auto px-9 py-4 rounded-full ${activeColor.bg} text-white font-extrabold uppercase tracking-widest text-xs transition-all ${activeColor.bgHover} active:scale-95 shadow-2xl ${activeColor.accentGlow} flex items-center justify-center gap-2 group`}
            >
              Get Elite Class Pass
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
            <a 
              href="#plans" 
              className="w-full sm:w-auto px-9 py-4 rounded-full glass-card text-white font-extrabold uppercase tracking-widest text-xs transition hover:bg-zinc-900 border border-zinc-800/80 flex items-center justify-center gap-2"
            >
              Explore Tiers
            </a>
          </div>

          {/* Ticker Stats / Live Counters */}
          <div className="grid grid-cols-3 gap-4 sm:gap-12 mt-20 max-w-4xl w-full border-t border-zinc-900 pt-12">
            <div className="flex flex-col items-center">
              <span className="font-display text-4xl sm:text-6xl font-black text-white leading-none">
                {counters.members}+
              </span>
              <span className="text-[9px] sm:text-xs text-zinc-500 uppercase tracking-widest font-bold mt-2">Active Members</span>
            </div>
            <div className="flex flex-col items-center border-x border-zinc-900/80 px-4">
              <span className={`font-display text-4xl sm:text-6xl font-black ${activeColor.primary} leading-none`}>
                {counters.trainers}+
              </span>
              <span className="text-[9px] sm:text-xs text-zinc-500 uppercase tracking-widest font-bold mt-2">Elite Coaches</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-display text-4xl sm:text-6xl font-black text-white leading-none">
                {counters.rate}%
              </span>
              <span className="text-[9px] sm:text-xs text-zinc-500 uppercase tracking-widest font-bold mt-2">Success Rate</span>
            </div>
          </div>
        </div>

        {/* Scroll down mouse animation indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 hidden md:block">
          <a href="#about" className="flex flex-col items-center gap-2 group">
            <span className="text-zinc-600 group-hover:text-zinc-300 text-[10px] uppercase tracking-widest font-bold transition">Discover</span>
            <div className="w-5 h-8 border border-zinc-800 rounded-full flex justify-center p-0.5">
              <div className={`w-1.5 h-2.5 ${activeColor.bg} rounded-full animate-bounce`} />
            </div>
          </a>
        </div>
      </section>

      {/* ----------------- 2. ABOUT SECTION ----------------- */}
      <section id="about" className="py-24 relative border-t border-zinc-900 bg-zinc-950/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            {/* Left side: Premium Collage */}
            <div className="relative">
              <div className={`absolute -top-4 -left-4 w-20 h-20 border-t-2 border-l-2 ${activeColor.border} opacity-40`} />
              <div className="grid grid-cols-2 gap-4">
                <img 
                  src="https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=600&q=80" 
                  alt="Premium Equipment" 
                  className="rounded-lg object-cover h-72 w-full shadow-2xl border border-zinc-800/80 transition duration-500 hover:scale-[1.02]"
                />
                <img 
                  src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80" 
                  alt="Workout Vibe" 
                  className="rounded-lg object-cover h-72 w-full shadow-2xl border border-zinc-800/80 mt-10 transition duration-500 hover:scale-[1.02]"
                />
              </div>
              <div className="absolute -bottom-6 -right-4 glass-panel rounded-xl p-4.5 border border-zinc-800/80 flex items-center gap-3.5 shadow-2xl">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <Award className={`w-5 h-5 ${activeColor.primary}`} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">Premium Standard</h4>
                  <p className="text-zinc-500 text-[10px] mt-0.5">35+ Verified Local Ratings</p>
                </div>
              </div>
            </div>

            {/* Right side: Content */}
            <div className="lg:pl-6">
              <span className={`text-xs uppercase tracking-widest font-extrabold ${activeColor.primary}`}>ABOUT THE DEN</span>
              <h2 className="font-display font-black text-3xl sm:text-5xl text-white uppercase tracking-tight mt-2 mb-6">
                Peshawar's Premier Sports Ground
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Situated prominently on Nasir Bagh Road, The Den represents a zero-compromise approach to bodybuilding, powerlifting, and fat loss. We supply the high-end plate-loaded machines and personalized metabolic guidelines you need to bypass standard gym stagnation.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                <div className="flex gap-3">
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-850 h-fit">
                    <Target className={`w-4 h-4 ${activeColor.primary}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Biomechanical Focus</h4>
                    <p className="text-zinc-500 text-xs mt-1">Exercises mapped explicitly to personal muscle range limits.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-850 h-fit">
                    <Activity className={`w-4 h-4 ${activeColor.primary}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">High-End Conditioning</h4>
                    <p className="text-zinc-500 text-xs mt-1">Rowers, assault air-bikes, and Olympic bumper platforms.</p>
                  </div>
                </div>
              </div>

              <div className="border-l border-zinc-700 pl-4 py-2 bg-zinc-900/30 rounded-r-lg mb-8">
                <p className="italic text-zinc-300 text-xs sm:text-sm">
                  "No compromises. We set out to install the ultimate strength training infrastructure for Peshawar's elite athletes and professionals."
                </p>
                <span className="block text-[9px] text-zinc-500 uppercase tracking-widest font-bold mt-2">— The Den Executive Board</span>
              </div>

              <a 
                href="#plans" 
                className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${activeColor.primary} hover:underline`}
              >
                Compare Packages <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>

        </div>
      </section>

      {/* ----------------- 3. SERVICES SECTION ----------------- */}
      <section id="services" className="py-24 bg-zinc-950 relative border-t border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className={`text-xs uppercase tracking-widest font-extrabold ${activeColor.primary}`}>PROFESSIONAL PROGRAMS</span>
            <h2 className="font-display font-black text-3xl sm:text-5xl text-white uppercase tracking-tight mt-2 mb-4">
              SERVICES BUILT FOR RESULTS
            </h2>
            <p className="text-zinc-500 text-sm">
              Click on any card below to launch the booking scheduler with that specific program pre-selected automatically.
            </p>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((svc) => {
              const IconComponent = svc.icon;
              return (
                <div 
                  key={svc.id}
                  onClick={() => {
                    setBookingForm({ ...bookingForm, classType: svc.title });
                    setBookingOpen(true);
                  }}
                  className="glass-card rounded-xl overflow-hidden cursor-pointer group flex flex-col hover:border-zinc-700/80 transition-all duration-300"
                >
                  <div className="relative h-48 w-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent z-10" />
                    <img 
                      src={svc.img} 
                      alt={svc.title} 
                      className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    />
                    <span className={`absolute top-4 left-4 z-20 text-[9px] uppercase font-extrabold tracking-widest py-1 px-3 rounded bg-zinc-950/90 text-zinc-300 border border-zinc-800 backdrop-blur-md`}>
                      {svc.badge}
                    </span>
                  </div>

                  <div className="p-6 flex-grow flex flex-col">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg bg-zinc-900 border border-zinc-850 ${activeColor.primary} group-hover:bg-zinc-800 transition-colors`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <h3 className="font-display font-extrabold text-xl text-white tracking-wide uppercase">{svc.title}</h3>
                    </div>
                    <p className="text-zinc-400 text-xs leading-relaxed mb-6 flex-grow">
                      {svc.desc}
                    </p>
                    
                    <div className={`flex items-center justify-between text-[10px] font-bold uppercase tracking-widest ${activeColor.primary} pt-4 border-t border-zinc-900`}>
                      <span>Book Slot</span>
                      <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ----------------- 4. TRAINERS SECTION ----------------- */}
      <section id="trainers" className="py-24 relative border-t border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-20">
            <span className={`text-xs uppercase tracking-widest font-extrabold ${activeColor.primary}`}>THE COACHING TEAM</span>
            <h2 className="font-display font-black text-3xl sm:text-5xl text-white uppercase tracking-tight mt-2 mb-4">
              ELITE ATHLETIC INSTRUCTORS
            </h2>
            <p className="text-zinc-500 text-sm">
              Highly certified biokinetics specialists committed to sustainable structural training patterns.
            </p>
          </div>

          {/* Trainers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-card rounded-xl overflow-hidden group border border-zinc-900 hover:border-zinc-800 transition-all duration-300">
              <div className="relative h-96 w-full overflow-hidden bg-zinc-950">
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent z-10" />
                <img 
                  src="https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=600&q=80" 
                  alt="Usman Shinwari" 
                  className="w-full h-full object-cover object-top transition duration-700 group-hover:scale-103"
                />
                <div className="absolute bottom-6 left-6 right-6 z-20">
                  <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded ${activeColor.bg} text-white`}>
                    Strength
                  </span>
                  <h3 className="font-display font-black text-2xl text-white uppercase tracking-tight mt-2">Usman Shinwari</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Peshawar Powerlifting Champion | 10+ Yrs</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl overflow-hidden group border border-zinc-900 hover:border-zinc-800 transition-all duration-300">
              <div className="relative h-96 w-full overflow-hidden bg-zinc-950">
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent z-10" />
                <img 
                  src="https://images.unsplash.com/photo-1548690312-e3b507d8c110?auto=format&fit=crop&w=600&q=80" 
                  alt="Sarah Afridi" 
                  className="w-full h-full object-cover object-top transition duration-700 group-hover:scale-103"
                />
                <div className="absolute bottom-6 left-6 right-6 z-20">
                  <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded ${activeColor.bg} text-white`}>
                    Fat Loss & Mobility
                  </span>
                  <h3 className="font-display font-black text-2xl text-white uppercase tracking-tight mt-2">Sarah Afridi</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">ISSA Certified Specialist | Dietetics Degree</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl overflow-hidden group border border-zinc-900 hover:border-zinc-800 transition-all duration-300">
              <div className="relative h-96 w-full overflow-hidden bg-zinc-950">
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent z-10" />
                <img 
                  src="https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=600&q=80" 
                  alt="Zarar Khan" 
                  className="w-full h-full object-cover object-top transition duration-700 group-hover:scale-103"
                />
                <div className="absolute bottom-6 left-6 right-6 z-20">
                  <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded ${activeColor.bg} text-white`}>
                    Calisthenics
                  </span>
                  <h3 className="font-display font-black text-2xl text-white uppercase tracking-tight mt-2">Zarar Khan</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Anatomical Calisthenics Master | Kinesiology</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ----------------- 5. MEMBERSHIP PLANS ----------------- */}
      <section id="plans" className="py-24 bg-zinc-950 relative border-t border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className={`text-xs uppercase tracking-widest font-extrabold ${activeColor.primary}`}>MEMBERSHIPS</span>
            <h2 className="font-display font-black text-3xl sm:text-5xl text-white uppercase tracking-tight mt-2 mb-4">
              ELITE PRICING SCHEMES
            </h2>
            <p className="text-zinc-550 text-sm">
              Commit to consistent strength progression. Bi-annual packages enjoy 20% discount upfront.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            
            {/* Basic Plan */}
            <div className="glass-card rounded-xl p-8 flex flex-col relative border border-zinc-900">
              <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Standard Tier</span>
              <h3 className="font-display text-2xl text-white font-extrabold mt-1">Basic</h3>
              
              <div className="my-6">
                <span className="text-zinc-500 text-xs font-semibold">PKR</span>
                <span className="text-4xl font-display font-black text-white ml-1">5,000</span>
                <span className="text-zinc-500 text-[10px] font-medium"> / Month</span>
              </div>
              
              <p className="text-zinc-500 text-xs mb-6">Access premium physical training gears during daytime slots.</p>
              
              <ul className="space-y-4 mb-8 flex-grow">
                <li className="flex items-center gap-3 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Gym access slots (06 AM - 04 PM)
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Elite hammer strength machinery
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Lockers & premium showers
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-650 line-through">
                  <X className="w-3.5 h-3.5 text-red-500/50 flex-shrink-0" /> Dedicated coach templates
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-650 line-through">
                  <X className="w-3.5 h-3.5 text-red-500/50 flex-shrink-0" /> Custom diet specifications
                </li>
              </ul>

              <button 
                onClick={() => openBookingWithPlan('Basic')}
                className="w-full py-3.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white font-bold text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-2"
              >
                {currentUser ? 'Choose Basic' : '🔒 Sign In to Book'}
              </button>
            </div>

            {/* Standard Plan (Highlight / Most Popular) */}
            <div className="glass-card rounded-xl p-8 flex flex-col relative border-red-500/20 bg-red-500/[0.01] shadow-[0_0_40px_rgba(239,68,68,0.04)] scale-100 md:scale-105 z-10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4.5 py-1 rounded bg-red-600 text-white text-[9px] uppercase font-extrabold tracking-widest">
                RECOMMENDED
              </div>
              
              <span className="text-red-400 text-[10px] uppercase tracking-widest font-extrabold">Intermediate Elite</span>
              <h3 className="font-display text-2xl text-white font-extrabold mt-1">Standard</h3>
              
              <div className="my-6">
                <span className="text-zinc-500 text-xs font-semibold">PKR</span>
                <span className="text-4xl font-display font-black text-white ml-1">8,000</span>
                <span className="text-zinc-500 text-[10px] font-medium"> / Month</span>
              </div>
              
              <p className="text-zinc-450 text-xs mb-6">Designed for individuals requiring fully scalable timings and monthly kinetic audits.</p>
              
              <ul className="space-y-4 mb-8 flex-grow">
                <li className="flex items-center gap-3 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Unlimited slots (06 AM - 10:30 PM)
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Olympic Bumper Arrays & Cardio decks
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Sauna, locker rooms & shower access
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Monthly body biomechanics review
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Custom training template routine
                </li>
              </ul>

              <button 
                onClick={() => openBookingWithPlan('Standard')}
                className={`w-full py-4 rounded ${activeColor.bg} text-white font-black text-[10px] uppercase tracking-widest transition ${activeColor.bgHover} shadow-xl ${activeColor.accentGlow} flex items-center justify-center gap-2`}
              >
                {currentUser ? 'Choose Standard' : '🔒 Sign In to Book'}
              </button>
            </div>

            {/* Premium Plan */}
            <div className="glass-card rounded-xl p-8 flex flex-col relative border border-zinc-900">
              <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Uncompromising Elite</span>
              <h3 className="font-display text-2xl text-white font-extrabold mt-1">Premium</h3>
              
              <div className="my-6">
                <span className="text-zinc-500 text-xs font-semibold">PKR</span>
                <span className="text-4xl font-display font-black text-white ml-1">12,000</span>
                <span className="text-zinc-500 text-[10px] font-medium"> / Month</span>
              </div>
              
              <p className="text-zinc-550 text-xs mb-6">Fully optimized 1-on-1 performance mapping designed for zero failure thresholds.</p>
              
              <ul className="space-y-4 mb-8 flex-grow">
                <li className="flex items-center gap-3 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Full 24/7 priority access slots
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Elite Personal Coach assigned
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Bi-weekly metabolic scans
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Specialized sports nutrition plan
                </li>
                <li className="flex items-center gap-3 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> Free entry to high intensity sessions
                </li>
              </ul>

              <button 
                onClick={() => openBookingWithPlan('Premium')}
                className="w-full py-3.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white font-bold text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-2"
              >
                {currentUser ? 'Choose Premium' : '🔒 Sign In to Book'}
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* ----------------- 6. GALLERY SECTION ----------------- */}
      <section id="gallery" className="py-24 relative border-t border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-16 gap-6">
            <div>
              <span className={`text-xs uppercase tracking-widest font-extrabold ${activeColor.primary}`}>ARENA TOUR</span>
              <h2 className="font-display font-black text-3xl sm:text-5xl text-white uppercase tracking-tight mt-2">
                THE DEN DUGEON PREVIEW
              </h2>
            </div>
            
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-900">
              {['all', 'strength', 'cardio', 'personal', 'interior', 'classes'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setGalleryFilter(tab)}
                  className={`px-4 py-2 rounded text-[10px] font-bold uppercase tracking-widest transition ${
                    galleryFilter === tab 
                      ? `${activeColor.bg} text-white` 
                      : 'text-zinc-500 hover:text-white bg-transparent'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Gallery Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGallery.map((item, index) => (
              <div 
                key={item.id}
                onClick={() => setLightboxIndex(index)}
                className="group relative h-80 rounded-xl overflow-hidden cursor-pointer border border-zinc-900/60 shadow-2xl bg-zinc-950"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-0 group-hover:opacity-100 z-10 transition duration-300 flex items-end p-6" />
                <img 
                  src={item.img} 
                  alt={item.title} 
                  className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-103"
                  loading="lazy"
                />
                <div className="absolute bottom-6 left-6 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <h4 className="font-display text-lg text-white font-black uppercase tracking-wide">{item.title}</h4>
                  <span className={`text-[9px] ${activeColor.primary} uppercase tracking-widest font-bold flex items-center gap-1.5 mt-1`}>
                    <Eye className="w-3.5 h-3.5" /> Fullscreen View
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* GALLERY LIGHTBOX POPUP */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 bg-black/98 z-[999] flex items-center justify-center p-4">
          <button 
            onClick={() => setLightboxIndex(null)}
            className="absolute top-6 right-6 text-zinc-400 hover:text-white p-2.5 bg-zinc-900/80 rounded-full border border-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
          
          <button 
            onClick={prevLightbox}
            className="absolute left-6 text-zinc-400 hover:text-white p-3.5 bg-zinc-900/80 rounded-full border border-zinc-800 hidden sm:block"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="max-w-4xl max-h-[80vh] flex flex-col items-center">
            <img 
              src={filteredGallery[lightboxIndex].img} 
              alt={filteredGallery[lightboxIndex].title} 
              className="max-w-full max-h-[70vh] rounded-lg object-contain shadow-2xl border border-zinc-800"
            />
            <h3 className="font-display text-xl text-white font-black uppercase mt-6 tracking-widest">
              {filteredGallery[lightboxIndex].title}
            </h3>
            <span className="text-zinc-500 text-[10px] uppercase tracking-widest mt-1">
              {lightboxIndex + 1} / {filteredGallery.length}
            </span>
          </div>

          <button 
            onClick={nextLightbox}
            className="absolute right-6 text-zinc-400 hover:text-white p-3.5 bg-zinc-900/80 rounded-full border border-zinc-800 hidden sm:block"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* ----------------- 7. TESTIMONIALS SECTION ----------------- */}
      <section id="testimonials" className="py-24 bg-zinc-950 relative border-t border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className={`text-xs uppercase tracking-widest font-extrabold ${activeColor.primary}`}>TESTIMONIALS</span>
            <h2 className="font-display font-black text-3xl sm:text-5xl text-white uppercase tracking-tight mt-2 mb-4">
              REVIEWS FROM THE DEN WARRIORS
            </h2>
            <p className="text-zinc-550 text-sm">
              Real biomechanics, authentic results. Hear from our dedicated Peshawar lifters.
            </p>
          </div>

          {/* Testimonial slider card */}
          <div className="max-w-4xl mx-auto relative px-4">
            
            <div className="glass-card rounded-2xl p-8 sm:p-12 relative overflow-hidden border border-zinc-900 bg-zinc-900/30">
              <span className="absolute -top-6 -left-2 text-[120px] font-black text-white/5 font-display select-none">“</span>
              
              <div className="flex flex-col items-center text-center relative z-10">
                <div className="flex gap-1 mb-6 text-yellow-500">
                  {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>

                <p className="text-zinc-300 text-sm sm:text-lg leading-relaxed italic mb-8">
                  "{testimonials[currentTestimonial].comment}"
                </p>

                <div className="flex items-center gap-4">
                  <img 
                    src={testimonials[currentTestimonial].img} 
                    alt={testimonials[currentTestimonial].name} 
                    className="w-12 h-12 rounded-full object-cover border border-red-500/20 shadow-2xl"
                  />
                  <div className="text-left">
                    <h4 className="font-display font-bold text-base text-white uppercase tracking-wide">
                      {testimonials[currentTestimonial].name}
                    </h4>
                    <span className={`text-[10px] ${activeColor.primary} uppercase tracking-widest font-extrabold`}>
                      {testimonials[currentTestimonial].role}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-3 mt-8">
              <button 
                onClick={prevTestimonial}
                className="p-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition border border-zinc-850"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={nextTestimonial}
                className="p-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition border border-zinc-850"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ----------------- 8. CONTACT & MAPS SECTION (LOCAL SEO FOCUS) ----------------- */}
      <section id="contact" className="py-24 relative border-t border-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            
            {/* Left Column: Details */}
            <div>
              <span className={`text-xs uppercase tracking-widest font-extrabold ${activeColor.primary}`}>HEADQUARTERS</span>
              <h2 className="font-display font-black text-3xl sm:text-5xl text-white uppercase tracking-tight mt-2 mb-6">
                GET IN TOUCH
              </h2>

              <div className="space-y-6 mb-8 text-sm">
                
                <div className="flex gap-4">
                  <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-850 text-red-500 h-fit flex items-center justify-center">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-display text-base text-white font-bold uppercase tracking-wider">Den Facility Location</h4>
                    <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
                      Mashwani Business Center, Nasir Bagh Road, opposite Qasr e Memar, near Naseer Teaching Hospital, Malakandher, Peshawar, Pakistan
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="flex gap-4">
                    <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-850 text-red-500 h-fit flex items-center justify-center">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-display text-xs text-zinc-400 font-bold uppercase tracking-widest">Call / WhatsApp</h4>
                      <p className="text-white text-sm font-bold mt-1">{siteSettings.whatsappDisplay}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-850 text-yellow-500 h-fit flex items-center justify-center">
                      <Star className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                      <h4 className="font-display text-xs text-zinc-400 font-bold uppercase tracking-widest">Rating Standards</h4>
                      <p className="text-white text-sm font-bold mt-1">5.0 / 5.0 Rating</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-850 text-red-500 h-fit flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="w-full">
                    <h4 className="font-display text-base text-white font-bold uppercase tracking-wider mb-2">Opening Timings</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-zinc-500">
                      <div className="flex justify-between border-b border-zinc-900 pb-1">
                        <span>Mon - Sat:</span>
                        <span className="font-semibold text-white">06:00 AM - 10:30 PM</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-900 pb-1 text-red-400/80">
                        <span>Sunday:</span>
                        <span className="font-bold">Closed</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="h-64 rounded-xl overflow-hidden border border-zinc-900 shadow-2xl bg-zinc-950">
                <iframe 
                  title="The Den Fitness Gym Map"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3307.728876307981!2d71.45070267527632!3d34.00078861050013!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x38d917300c9e6cd5%3A0xebe77d441113b28b!2sNasir%20Bagh%20Rd%2C%20Peshawar%2C%20Khyber%20Pakhtunkhwa!5e0!3m2!1sen!2spk!4v1716982561912!5m2!1sen!2spk" 
                  className="w-full h-full border-0 filter invert-[0.92] hue-rotate-[180deg] brightness-[0.9]"
                  allowFullScreen="" 
                  loading="lazy" 
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

            </div>

            {/* Right Column: Contact form */}
            <div className="glass-card rounded-xl p-8 border border-zinc-900">
              <h3 className="font-display text-xl text-white font-extrabold uppercase mb-2">SEND AN INQUIRY</h3>
              <p className="text-zinc-500 text-xs mb-6">Drop your queries below and our desk manager will connect within 1-2 hours.</p>

              {contactSubmitted ? (
                <div className="p-8 text-center bg-emerald-500/5 border border-emerald-500/10 rounded-lg flex flex-col items-center gap-3 animate-fadeIn">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  <h4 className="text-white font-bold text-base">Inquiry Forwarded!</h4>
                  <p className="text-zinc-500 text-xs">A manager will WhatsApp or call you shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div>
                    <label className="block text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Zahir Shinwari"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      className="w-full px-4 py-3 rounded bg-zinc-900/60 border border-zinc-850 text-white text-xs focus:border-red-500 focus:outline-none transition"
                    />
                    {contactErrors.name && <span className="text-[10px] text-red-500 block mt-1">{contactErrors.name}</span>}
                  </div>

                  <div>
                    <label className="block text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Email Address</label>
                    <input 
                      type="email" 
                      placeholder="e.g. name@domain.com"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      className="w-full px-4 py-3 rounded bg-zinc-900/60 border border-zinc-850 text-white text-xs focus:border-red-500 focus:outline-none transition"
                    />
                    {contactErrors.email && <span className="text-[10px] text-red-500 block mt-1">{contactErrors.email}</span>}
                  </div>

                  <div>
                    <label className="block text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">Your Message</label>
                    <textarea 
                      rows="4"
                      placeholder="Type details about your inquiry..."
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      className="w-full px-4 py-3 rounded bg-zinc-900/60 border border-zinc-850 text-white text-xs focus:border-red-500 focus:outline-none transition resize-none"
                    />
                    {contactErrors.message && <span className="text-[10px] text-red-500 block mt-1">{contactErrors.message}</span>}
                  </div>

                  <button 
                    type="submit"
                    className={`w-full py-3.5 rounded ${activeColor.bg} text-white font-extrabold text-[10px] uppercase tracking-widest transition ${activeColor.bgHover} active:scale-98 flex items-center justify-center gap-2 shadow-xl ${activeColor.accentGlow}`}
                  >
                    Send Inquiry <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}

              {/* Floating CTA shortcuts */}
              <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-zinc-900">
                <a 
                  href="tel:03169636282"
                  className="flex items-center justify-center gap-2 py-2.5 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[10px] font-bold uppercase tracking-wider transition text-white"
                >
                  <Phone className="w-4.5 h-4.5 text-emerald-500" /> Phone Desk
                </a>
                <button 
                  onClick={() => setWhatsappOpen(true)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider transition text-emerald-400"
                >
                  <MessageCircle className="w-4.5 h-4.5" /> WhatsApp Chat
                </button>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ----------------- 9. FAQ ACCORDION SECTION ----------------- */}
      <section id="faqs" className="py-24 bg-zinc-950 relative border-t border-zinc-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          
          <div className="text-center mb-16">
            <span className={`text-xs uppercase tracking-widest font-extrabold ${activeColor.primary}`}>FAQS</span>
            <h2 className="font-display font-black text-3xl sm:text-5xl text-white uppercase tracking-tight mt-2 mb-4">
              FREQUENTLY ASKED QUESTIONS
            </h2>
            <p className="text-zinc-500 text-sm">
              Review standard pre-joining answers compiled directly from front-desk member logs.
            </p>
          </div>

          {/* Accordion List */}
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div 
                key={i} 
                className="glass-card rounded-lg overflow-hidden border border-zinc-900 hover:border-zinc-800 transition duration-300 bg-zinc-950/60"
              >
                <button 
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 font-semibold text-white focus:outline-none"
                >
                  <span className="text-xs sm:text-sm uppercase tracking-wider leading-snug">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${openFaq === i ? 'rotate-180 text-red-500' : ''}`} />
                </button>

                {openFaq === i && (
                  <div className="px-6 pb-6 text-zinc-400 text-xs leading-relaxed border-t border-zinc-900 pt-4 bg-[#07070a]/80">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ----------------- 10. PREMIUM FOOTER ----------------- */}
      <footer className="bg-black border-t border-zinc-950 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-16">
            
            {/* Column 1 */}
            <div>
              <a href="#hero" className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                  <Dumbbell className={`w-4 h-4 ${activeColor.primary}`} />
                </div>
                <span className="font-display font-extrabold text-xl tracking-tighter text-white">
                  THE <span className={activeColor.primary}>DEN</span>
                </span>
              </a>
              <p className="text-zinc-650 text-xs leading-relaxed mb-4">
                Uncompromising fitness dungeon in Peshawar loaded with high-performance plate-loaded biomechanics. Mapping targets to deliver raw power.
              </p>
              <div className="flex gap-2">
                {['F', 'I', 'T', 'Y'].map((soc) => (
                  <a key={soc} href="https://facebook.com" target="_blank" rel="noreferrer" className="w-8 h-8 rounded bg-zinc-900 border border-zinc-855 text-zinc-500 hover:text-white transition flex items-center justify-center text-xs font-bold">
                    {soc}
                  </a>
                ))}
              </div>
            </div>

            {/* Column 2 */}
            <div>
              <h4 className="font-display text-white font-bold uppercase tracking-widest text-xs mb-4">Quick Directory</h4>
              <ul className="space-y-2.5 text-xs text-zinc-600">
                <li><a href="#about" className="hover:text-white transition">About Den Gym</a></li>
                <li><a href="#services" className="hover:text-white transition">Services & Workouts</a></li>
                <li><a href="#plans" className="hover:text-white transition">Pricing Plans</a></li>
                <li><a href="#trainers" className="hover:text-white transition">Elite Trainers</a></li>
                <li><a href="#gallery" className="hover:text-white transition">Dungeon Gallery</a></li>
              </ul>
            </div>

            {/* Column 3 */}
            <div>
              <h4 className="font-display text-white font-bold uppercase tracking-widest text-xs mb-4">Support & Care</h4>
              <ul className="space-y-3 text-xs text-zinc-600">
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
                  <span>Nasir Bagh Road, Peshawar, PK</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <a href="tel:03169636282" className="hover:text-white transition">03169636282</a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <span>support@thedenpeshawar.com</span>
                </li>
              </ul>
            </div>

            {/* Column 4 */}
            <div>
              <h4 className="font-display text-white font-bold uppercase tracking-widest text-xs mb-4">SEO Highlights</h4>
              <p className="text-zinc-600 text-xs leading-relaxed mb-4">
                The Den is Peshawar's high-performance standard serving Nasir Bagh Road, Malakandher, Qasr e Memar, and university zones.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['#BestGymPeshawar', '#NasirBaghRoad', '#TheDenGym'].map((tag) => (
                  <span key={tag} className="text-[9px] bg-zinc-900 border border-zinc-850 text-zinc-500 py-0.5 px-2 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

          </div>

          {/* Copyright section with Secret Easter Egg Trigger */}
          <div className="pt-8 border-t border-zinc-955 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-600 gap-4">
            <p 
              onClick={handleEasterEggClick}
              className="cursor-pointer select-none hover:text-zinc-500 active:scale-99 transition"
              title="Secret Admin access"
            >
              © 2026 The Den Fitness Gym. Designed & developed by elite AI builders.
            </p>
            <div className="flex gap-4">
              <a href="#hero" className="hover:text-white transition">Privacy Policy</a>
              <span>•</span>
              <a href="#hero" className="hover:text-white transition">Terms of Service</a>
              {isAdminMode && (
                <>
                  <span>•</span>
                  <button 
                    onClick={() => setDemoOpen(true)}
                    className="text-red-500 hover:underline font-bold flex items-center gap-1"
                  >
                    <Settings className="w-3.5 h-3.5 animate-spin-slow" /> Developer Console
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </footer>

      {/* ----------------- ADVANCED INTERACTIVE BOOKING MODAL ----------------- */}
      {bookingOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[999] flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-zinc-850 overflow-hidden shadow-2xl relative animate-fadeIn">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 px-6 py-4 flex items-center justify-between border-b border-zinc-855">
              <div className="flex items-center gap-2">
                <Calendar className={`w-4 h-4 ${activeColor.primary}`} />
                <h3 className="font-display text-sm text-white font-bold uppercase tracking-wider">
                  {bookingStep === 2 ? 'Session Pending Confirmation' : 'Schedule Elite Class Pass'}
                </h3>
              </div>
              <button 
                onClick={() => { setBookingOpen(false); setBookingStep(1); }}
                className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-900 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {bookingStep === 1 ? (
                <form onSubmit={handleBookingSubmit} className="space-y-4">
                  {/* Select Plan */}
                  <div className="grid grid-cols-3 gap-2">
                    {['Basic', 'Standard', 'Premium'].map((plan) => (
                      <button
                        key={plan}
                        type="button"
                        onClick={() => setSelectedPlan(plan)}
                        className={`py-2 rounded text-[10px] font-bold uppercase tracking-widest border transition ${
                          selectedPlan === plan 
                            ? `${activeColor.bg} border-transparent text-white`
                            : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-white'
                        }`}
                      >
                        {plan}
                      </button>
                    ))}
                  </div>

                  {/* Name field */}
                  <div>
                    <label className="block text-zinc-450 text-[10px] font-bold uppercase tracking-wider mb-1">Your Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Zahir Khan"
                      value={bookingForm.name}
                      onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-red-500"
                    />
                    {bookingErrors.name && <span className="text-[10px] text-red-500 block mt-0.5">{bookingErrors.name}</span>}
                  </div>

                  {/* Email & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-zinc-450 text-[10px] font-bold uppercase tracking-wider mb-1">Your Email</label>
                      <input 
                        type="email" 
                        required
                        placeholder="e.g. zahir@example.com"
                        value={bookingForm.email}
                        onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-red-500"
                      />
                      {bookingErrors.email && <span className="text-[10px] text-red-500 block mt-0.5">{bookingErrors.email}</span>}
                    </div>

                    <div>
                      <label className="block text-zinc-450 text-[10px] font-bold uppercase tracking-wider mb-1">Phone Number</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. 03169636282"
                        value={bookingForm.phone}
                        onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-red-500"
                      />
                      {bookingErrors.phone && <span className="text-[10px] text-red-500 block mt-0.5">{bookingErrors.phone}</span>}
                    </div>
                  </div>

                  {/* Class selection & slots */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-zinc-450 text-[10px] font-bold uppercase tracking-wider mb-1">Service Program</label>
                      <select
                        value={bookingForm.classType}
                        onChange={(e) => setBookingForm({ ...bookingForm, classType: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-red-500"
                      >
                        <option>Weight Training</option>
                        <option>Cardio Training</option>
                        <option>Personal Training</option>
                        <option>Strength Programs</option>
                        <option>Fat Loss Programs</option>
                        <option>Fitness Coaching</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-zinc-450 text-[10px] font-bold uppercase tracking-wider mb-1">Time Slot Preference</label>
                      <select
                        value={bookingForm.timeSlot}
                        onChange={(e) => setBookingForm({ ...bookingForm, timeSlot: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-red-500"
                      >
                        <option>Morning (06:00 AM - 12:00 PM)</option>
                        <option>Afternoon (12:00 PM - 04:00 PM)</option>
                        <option>Evening (04:00 PM - 10:30 PM)</option>
                      </select>
                    </div>
                  </div>

                  {/* Comments */}
                  <div>
                    <label className="block text-zinc-450 text-[10px] font-bold uppercase tracking-wider mb-1">Injury / Fitness Comments (Optional)</label>
                    <textarea 
                      rows="2"
                      placeholder="Mention any physical restrictions..."
                      value={bookingForm.comments}
                      onChange={(e) => setBookingForm({ ...bookingForm, comments: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-red-500 resize-none"
                    />
                  </div>

                  {/* Submission and pricing details */}
                  <div className="pt-4 border-t border-zinc-900 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase font-bold block">Estimated Cost</span>
                      <span className="text-lg font-display font-black text-white">
                        {selectedPlan === 'Basic' ? 'PKR 5,000' : selectedPlan === 'Standard' ? 'PKR 8,000' : 'PKR 12,000'}
                      </span>
                    </div>
                    <button 
                      type="submit"
                      className={`px-6 py-3.5 rounded ${activeColor.bg} text-white font-extrabold text-[10px] uppercase tracking-widest transition ${activeColor.bgHover}`}
                    >
                      Register Booking
                    </button>
                  </div>

                </form>
              ) : (
                <div className="text-center py-6 flex flex-col items-center gap-5">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-display text-xl text-white font-bold uppercase">Booking Registered Online!</h4>
                    <p className="text-zinc-400 text-xs mt-2 px-4 leading-relaxed">
                      Assigned <b>{bookingForm.name}</b> for the <b>{selectedPlan} Plan</b>. To securely process your admission and confirm payment slots, please tap the WhatsApp checkout receipt link below:
                    </p>
                  </div>
                  
                  {/* High converting direct WhatsApp Checkout button! */}
                  <a 
                    href={generateWhatsAppCheckoutUrl()}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      setBookingOpen(false);
                      setBookingStep(1);
                    }}
                    className="w-full py-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest transition shadow-lg flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-5 h-5 fill-current" /> Tap to Confirm via WhatsApp
                  </a>

                  <button 
                    onClick={() => {
                      setBookingOpen(false);
                      setBookingStep(1);
                      setBookingForm({ name: '', email: '', phone: '', classType: 'Weight Training', timeSlot: 'Morning (06:00 AM - 12:00 PM)', comments: '' });
                    }}
                    className="text-zinc-500 hover:text-zinc-350 text-[10px] uppercase tracking-widest font-bold transition"
                  >
                    Done & Close Window
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ----------------- FLOATING WHATSAPP CHAT PREVIEW DRAWER ----------------- */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Expanded WhatsApp Box */}
        {whatsappOpen && (
          <div className="w-80 glass-panel border border-zinc-800 rounded-xl overflow-hidden shadow-2xl animate-slideUp bg-zinc-950">
            <div className="bg-emerald-600 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-white text-base">D</div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-emerald-600" />
                </div>
                <div>
                  <h4 className="text-xs font-bold">The Den Front Desk</h4>
                  <span className="text-[9px] text-emerald-200">Online | Quick Response</span>
                </div>
              </div>
              <button onClick={() => setWhatsappOpen(false)} className="hover:opacity-75 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 bg-[#0a0d14] max-h-48 overflow-y-auto text-xs space-y-3">
              <div className="bg-zinc-900 text-zinc-300 p-2.5 rounded-lg max-w-[85%] border border-zinc-850 leading-relaxed">
                💪 Assalam-o-Alaikum! Welcome to The Den Gym. Type your message below to directly chat with us on WhatsApp!
              </div>
            </div>

            <div className="p-3 bg-zinc-950 border-t border-zinc-900/60 flex gap-2">
              <input 
                type="text"
                placeholder="Type message here..."
                value={whatsappMsg}
                onChange={(e) => setWhatsappMsg(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && triggerWhatsApp()}
                className="flex-grow px-3 py-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-emerald-500"
              />
              <button 
                onClick={triggerWhatsApp}
                className="p-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons Container */}
        <div className="flex gap-2">
          {showBackToTop && (
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="p-3 rounded-full bg-zinc-900 hover:bg-zinc-850 text-white border border-zinc-800 transition shadow-lg"
              title="Back to Top"
            >
              <ArrowUpRight className="w-4.5 h-4.5 -rotate-45" />
            </button>
          )}

          {/* Settings Customizer toggle (Client Wow factor) */}
          {isAdminMode && (
            <button 
              onClick={() => setDemoOpen(!demoOpen)}
              className="p-3.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 transition shadow-lg relative group"
              title="Developer Design Customizer"
            >
              <Settings className="w-5 h-5 animate-spin-slow" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-650 rounded-full animate-ping" />
            </button>
          )}

          <button 
            onClick={() => setWhatsappOpen(!whatsappOpen)}
            className="p-3.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-2xl relative flex items-center justify-center"
            title="WhatsApp Live"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ----------------- 🔐 ADVANCED FULL-FEATURED ADMIN CONTROL PANEL (LEDGER & FINANCIAL AUDITOR) ----------------- */}
      {isAdminMode && demoOpen && (
        <div className="fixed inset-4 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[500px] z-[99] glass-panel rounded-2xl border border-zinc-850 shadow-2xl overflow-hidden animate-slideUp flex flex-col max-h-[85vh] bg-zinc-950">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 px-5 py-4 border-b border-zinc-855 flex items-center justify-between text-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-red-500 animate-spin" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider">Gym Owner Admin Ledger</h3>
            </div>
            <button onClick={() => setDemoOpen(false)} className="hover:opacity-75 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Ledger Content Area */}
          <div className="p-5 overflow-y-auto flex-grow space-y-6 text-xs text-zinc-400">
            
            {/* Financial Auditor Widgets */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-850">
                <span className="text-zinc-550 text-[8px] uppercase tracking-widest font-black block">Total Paid Revenue</span>
                <span className="text-emerald-400 text-lg font-display font-black mt-1 block">
                  PKR {totalRevenue.toLocaleString()}
                </span>
                <span className="text-[7.5px] text-zinc-600 block mt-0.5">From confirmed paid accounts</span>
              </div>
              <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-850">
                <span className="text-zinc-550 text-[8px] uppercase tracking-widest font-black block">Pending Receivables</span>
                <span className="text-amber-500 text-lg font-display font-black mt-1 block">
                  PKR {pendingRevenue.toLocaleString()}
                </span>
                <span className="text-[7.5px] text-zinc-650 block mt-0.5">Awaiting WhatsApp validation</span>
              </div>
            </div>

            {/* Accent Color Switcher */}
            <div>
              <h4 className="font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-zinc-400" /> Dynamic Theme Preset
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { name: 'red', label: 'Vibrant Red' },
                  { name: 'gold', label: 'Elite Gold' },
                  { name: 'emerald', label: 'Active Green' },
                  { name: 'cyan', label: 'Modern Cyan' }
                ].map((col) => (
                  <button
                    key={col.name}
                    onClick={() => {
                      setThemeAccent(col.name);
                      triggerToast(`🎨 Theme color adjusted to ${col.label}`);
                    }}
                    className={`py-2 rounded font-semibold transition border text-[9px] uppercase tracking-widest ${
                      themeAccent === col.name 
                        ? 'bg-zinc-800 text-white border-zinc-700' 
                        : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Interactive Ledger Directory */}
            <div>
              <div className="flex items-center justify-between mb-3 gap-4">
                <h4 className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5 text-zinc-400" /> Bookings Ledger Directory
                </h4>
                
                {/* Manual offline register toggle */}
                <button 
                  onClick={() => setShowOfflineBooker(!showOfflineBooker)}
                  className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-[9px] hover:text-white font-extrabold uppercase tracking-widest flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-red-500" /> Offline Book
                </button>
              </div>

              {/* Manual Offline Booker Form Dropdown */}
              {showOfflineBooker && (
                <form onSubmit={handleOfflineBookingSubmit} className="bg-zinc-900/60 p-4 rounded-lg border border-zinc-800/80 mb-4 space-y-3">
                  <h5 className="font-bold text-white uppercase tracking-widest text-[9px] border-b border-zinc-850 pb-1.5 flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-amber-500" /> Register Offline Walk-In
                  </h5>
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text" 
                      placeholder="Client Full Name"
                      required
                      value={offlineForm.name}
                      onChange={(e) => setOfflineForm({ ...offlineForm, name: e.target.value })}
                      className="px-2.5 py-1.5 text-[10px] rounded bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-red-500"
                    />
                    <input 
                      type="text" 
                      placeholder="WhatsApp Mobile"
                      required
                      value={offlineForm.phone}
                      onChange={(e) => setOfflineForm({ ...offlineForm, phone: e.target.value })}
                      className="px-2.5 py-1.5 text-[10px] rounded bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select 
                      value={offlineForm.plan}
                      onChange={(e) => setOfflineForm({ ...offlineForm, plan: e.target.value })}
                      className="px-2 py-1 text-[9px] rounded bg-zinc-955 border border-zinc-800 text-zinc-300"
                    >
                      <option>Basic</option>
                      <option>Standard</option>
                      <option>Premium</option>
                    </select>
                    <select 
                      value={offlineForm.classType}
                      onChange={(e) => setOfflineForm({ ...offlineForm, classType: e.target.value })}
                      className="px-2 py-1 text-[9px] rounded bg-zinc-955 border border-zinc-800 text-zinc-300"
                    >
                      <option>Weight Training</option>
                      <option>Cardio Training</option>
                      <option>Personal Training</option>
                      <option>Strength Programs</option>
                    </select>
                    <select 
                      value={offlineForm.status}
                      onChange={(e) => setOfflineForm({ ...offlineForm, status: e.target.value })}
                      className="px-2 py-1 text-[9px] rounded bg-zinc-955 border border-zinc-800 text-zinc-300"
                    >
                      <option>Pending</option>
                      <option>Confirmed</option>
                      <option>Paid</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button 
                      type="button" 
                      onClick={() => setShowOfflineBooker(false)}
                      className="px-3 py-1 rounded bg-transparent border border-zinc-800 text-zinc-500"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className={`px-4 py-1 rounded ${activeColor.bg} text-white font-bold`}
                    >
                      Save Client
                    </button>
                  </div>
                </form>
              )}

              {/* Search & Filter Controls */}
              <div className="flex gap-2 mb-3">
                <input 
                  type="text" 
                  placeholder="Search name or mobile..."
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  className="flex-grow px-3 py-2 text-[10px] rounded bg-zinc-900 border border-zinc-850 text-white focus:outline-none"
                />
                <select
                  value={adminFilterPlan}
                  onChange={(e) => setAdminFilterPlan(e.target.value)}
                  className="px-3 py-2 text-[10px] rounded bg-zinc-900 border border-zinc-850 text-zinc-400"
                >
                  <option value="all">All Plans</option>
                  <option value="basic">Basic</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              {/* Booking Ledger Rows */}
              <div className="bg-[#07070a] border border-zinc-900 rounded-lg max-h-56 overflow-y-auto divide-y divide-zinc-950">
                {filteredBookingsForAdmin.length === 0 ? (
                  <div className="p-8 text-center text-zinc-600">
                    No matching bookings found in search.
                  </div>
                ) : (
                  filteredBookingsForAdmin.map((bk) => (
                    <div key={bk.id} className="p-3 hover:bg-zinc-900/30 flex items-center justify-between gap-4 transition">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-[11px]">{bk.name}</span>
                          <span className="bg-red-500/10 text-red-400 text-[8px] uppercase tracking-widest px-1 rounded font-bold">
                            {bk.plan} (PKR {bk.cost?.toLocaleString()})
                          </span>
                        </div>
                        <span className="text-[9px] text-zinc-550 block mt-0.5">
                          📞 {bk.phone} | Slot: {bk.classType}
                        </span>
                      </div>
                      
                      {/* Action status controller */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleBookingStatus(bk.id, bk.status)}
                          className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded tracking-widest transition cursor-pointer ${
                            bk.status === 'Paid' 
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' 
                              : bk.status === 'Confirmed'
                              ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                              : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                          }`}
                          title="Click to toggle status (Pending ➔ Confirmed ➔ Paid)"
                        >
                          {bk.status}
                        </button>
                        
                        <button 
                          onClick={() => deleteBooking(bk.id)}
                          className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-red-500 border border-zinc-850"
                          title="Delete Booking"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── USER AUTH DRAWER ── */}
      {userAuthOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fadeIn">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setUserAuthOpen(false)}
          />
          
          {/* Sliding Panel */}
          <div className="relative w-full max-w-md h-full bg-[#08080a] border-l border-zinc-900 p-6 sm:p-8 flex flex-col justify-between shadow-2xl animate-slideLeft z-10 text-left">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <Dumbbell className={`w-5 h-5 ${activeColor.primary}`} />
                  <span className="font-display font-extrabold text-xl tracking-tight text-white">MEMBER PORTAL</span>
                </div>
                <button 
                  onClick={() => setUserAuthOpen(false)}
                  className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-850 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-900 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setUserAuthMode('login');
                    setUserAuthError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition ${userAuthMode === 'login' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-550 hover:text-zinc-350'}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserAuthMode('signup');
                    setUserAuthError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition ${userAuthMode === 'signup' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-550 hover:text-zinc-350'}`}
                >
                  Sign Up
                </button>
              </div>

              {/* Form */}
              <form onSubmit={userAuthMode === 'login' ? handleUserLogin : handleUserSignup} className="space-y-4">
                {userAuthError && (
                  <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-400 rounded-lg text-xs font-semibold flex items-center gap-2 animate-pulse">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{userAuthError}</span>
                  </div>
                )}

                {userAuthMode === 'signup' && (
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Abdullah Hanif"
                      value={userAuthName}
                      onChange={(e) => setUserAuthName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-850 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. member@theden.com"
                    value={userAuthEmail}
                    onChange={(e) => setUserAuthEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-850 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={userAuthPassword}
                    onChange={(e) => setUserAuthPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-850 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={userAuthLoading}
                  className={`w-full py-3.5 rounded-lg ${activeColor.bg} text-white font-extrabold text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 mt-6 ${activeColor.bgHover} disabled:opacity-50`}
                >
                  {userAuthLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>{userAuthMode === 'login' ? 'Sign In to Portal' : 'Register Account'}</span>
                  )}
                </button>
              </form>
            </div>

            {/* Bottom Guard Notice */}
            <div className="pt-6 border-t border-zinc-900 text-center">
              <p className="text-[10px] text-zinc-650 flex items-center justify-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> SECURE END-TO-END SYSTEM ENCRYPTION
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
