import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './pages/AuthPage';
import LabDiscovery from './pages/LabDiscovery';
import LabDashboard from './pages/LabDashboard';
import LabOverview from './pages/LabOverview';
import CenterDashboard from './pages/CenterDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import CenterTeam from './pages/CenterTeam';
import OrdersView from './components/OrdersView';
import QuotationsView from './components/QuotationsView';
import NewOrderModal from './components/NewOrderModal';
import QuotationModal from './components/QuotationModal';
import NotificationBell from './components/NotificationBell';
import ProfileSettings from './components/ProfileSettings';
import OrderDetailModal from './components/OrderDetailModal';
import { useNotifications } from './lib/useNotifications';
import { supabase, Profile, Service, Order, Notification } from './lib/supabase';
import {
  Microscope, Search, ClipboardList, MessageSquare, LayoutDashboard,
  LogOut, Users, Settings, Menu, X, Building2, Stethoscope, UserCog,
  MessageCircle,
} from 'lucide-react';

type Tab = 'discover' | 'orders' | 'quotations' | 'lab-dashboard' | 'lab-overview' | 'team' | 'center-dashboard' | 'doctor-dashboard';

interface LiveToast {
  id: string;
  notification: Notification;
}

function Shell() {
  const { profile, loading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('discover');
  const [orderTarget, setOrderTarget] = useState<Profile | null>(null);
  const [quotationTarget, setQuotationTarget] = useState<Profile | null>(null);
  const [orderServices, setOrderServices] = useState<Service[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [quickOrder, setQuickOrder] = useState<Order | null>(null);
  const [toasts, setToasts] = useState<LiveToast[]>([]);
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = toastTimers.current.get(id);
    if (timer) { clearTimeout(timer); toastTimers.current.delete(id); }
  }, []);

  const handleIncomingNotification = useCallback((n: Notification) => {
    if (n.type !== 'new_comment') return;
    const toast: LiveToast = { id: n.id, notification: n };
    setToasts(prev => [toast, ...prev].slice(0, 4));
    const timer = setTimeout(() => dismissToast(n.id), 6000);
    toastTimers.current.set(n.id, timer);
  }, [dismissToast]);

  const { notifications, unreadCount, markAllRead, markRead } = useNotifications({
    onIncoming: handleIncomingNotification,
  });

  const handleOpenOrder = useCallback(async (orderId: string) => {
    const { data } = await supabase
      .from('orders')
      .select('*, from_profile:profiles!orders_from_id_fkey(*), lab_profile:profiles!orders_lab_id_fkey(*), service:services(*), attachments:order_attachments(*)')
      .eq('id', orderId)
      .maybeSingle();
    if (data) setQuickOrder(data as Order);
  }, []);

  useEffect(() => {
    if (profile) {
      if (profile.role === 'lab') setTab('lab-overview');
      else if (profile.role === 'center') setTab('center-dashboard');
      else if (profile.role === 'doctor') setTab('doctor-dashboard');
      else setTab('discover');
    }
  }, [profile?.id]);

  useEffect(() => {
    const timers = toastTimers.current;
    return () => { timers.forEach(clearTimeout); };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center animate-pulse">
            <Microscope className="w-5 h-5 text-white" />
          </div>
          <p className="text-sm text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) return <AuthPage />;

  const isLab = profile.role === 'lab';
  const isCenter = profile.role === 'center';
  const isDoctor = profile.role === 'doctor';

  const handleSelectLab = async (lab: Profile) => {
    const { data: services } = await supabase.from('services').select('*').eq('lab_id', lab.id);
    setOrderServices(services ?? []);
    setOrderTarget(lab);
  };

  const navItems: {
    id: Tab; label: string; icon: React.ReactNode;
    labOnly?: boolean; clientOnly?: boolean; labHidden?: boolean;
    centerOnly?: boolean; doctorOnly?: boolean;
  }[] = [
    { id: 'doctor-dashboard',  label: 'Home',        icon: <LayoutDashboard className="w-5 h-5" />, doctorOnly: true },
    { id: 'center-dashboard',  label: 'Home',        icon: <LayoutDashboard className="w-5 h-5" />, centerOnly: true },
    { id: 'lab-overview',      label: 'Home',        icon: <LayoutDashboard className="w-5 h-5" />, labOnly: true },
    { id: 'discover',          label: 'Find Labs',   icon: <Search className="w-5 h-5" />,          clientOnly: true },
    { id: 'orders',            label: 'Orders',      icon: <ClipboardList className="w-5 h-5" /> },
    { id: 'quotations',        label: 'Quotes',      icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'team',              label: 'Team',        icon: <Users className="w-5 h-5" />,            labHidden: true },
    { id: 'lab-dashboard',     label: 'Profile',     icon: <UserCog className="w-5 h-5" />,          labOnly: true },
  ];

  const visibleNav = navItems.filter(n => {
    if (n.labOnly && !isLab) return false;
    if (n.clientOnly && isLab) return false;
    if (n.labHidden && isLab) return false;
    if (n.centerOnly && !isCenter) return false;
    if (n.doctorOnly && !isDoctor) return false;
    return true;
  });

  // Bottom nav: max 4 items + settings
  const bottomNavItems = visibleNav.slice(0, 4);

  // Count comment-type unread notifications for orders badge
  const orderUnread = notifications.filter(n => !n.read && (n.type === 'new_comment' || n.type === 'new_order' || n.type === 'order_update')).length;

  const RoleIcon = isLab ? Microscope : isCenter ? Building2 : Stethoscope;
  const roleLabel = isCenter ? 'Dental Center' : isDoctor ? 'Doctor' : 'Dental Lab';

  const navigate = (t: Tab) => { setTab(t); setMobileMenuOpen(false); };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* ── Top header ── */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30"
              style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Microscope className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-neutral-900">Bridge</span>
            </div>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {visibleNav.map(item => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === item.id ? 'bg-primary-50 text-primary-700' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                  }`}
                >
                  {item.icon}
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllRead={markAllRead}
              onMarkRead={markRead}
              onNavigate={(t) => setTab(t as Tab)}
              onOpenOrder={handleOpenOrder}
            />

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-neutral-50 rounded-xl border border-neutral-200 ml-1">
              {profile.logo_url ? (
                <img src={profile.logo_url} alt={profile.name} className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                  <RoleIcon className="w-3.5 h-3.5 text-primary-600" />
                </div>
              )}
              <div className="text-xs">
                <p className="font-semibold text-neutral-900 leading-none">{profile.name}</p>
                <p className="text-neutral-400 mt-0.5">{roleLabel}</p>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(true)}
              className="hidden md:flex p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              title="Settings"
            >
              <Settings className="w-[18px] h-[18px]" />
            </button>

            <button
              onClick={() => signOut()}
              className="hidden md:flex p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile hamburger (shows more options beyond bottom nav) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-neutral-500 hover:bg-neutral-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile overflow menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-100 px-4 py-2 flex flex-col gap-1 bg-white shadow-lg">
            {visibleNav.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  tab === item.id ? 'bg-primary-50 text-primary-700' : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {item.icon}{item.label}
              </button>
            ))}
            <div className="border-t border-neutral-100 mt-1 pt-1">
              <button
                onClick={() => { setShowSettings(true); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                <Settings className="w-5 h-5" /> Settings
              </button>
              <button
                onClick={() => signOut()}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-5 h-5" /> Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
        {tab === 'center-dashboard' && isCenter && <CenterDashboard />}
        {tab === 'doctor-dashboard' && isDoctor && (
          <DoctorDashboard onNavigateDiscover={() => setTab('discover')} />
        )}
        {tab === 'lab-overview' && isLab && (
          <LabOverview onNavigateOrders={() => setTab('orders')} />
        )}
        {tab === 'discover' && !isLab && (
          <LabDiscovery
            onSelectLab={handleSelectLab}
            onRequestQuotation={(lab) => setQuotationTarget(lab)}
          />
        )}
        {tab === 'orders' && <OrdersView viewAs={isLab ? 'lab' : 'sender'} />}
        {tab === 'quotations' && <QuotationsView isLab={isLab} />}
        {tab === 'team' && !isLab && <CenterTeam />}
        {tab === 'lab-dashboard' && isLab && <LabDashboard />}
      </main>

      {/* ── Mobile bottom navigation ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-neutral-200 z-30 flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {bottomNavItems.map(item => {
          const isActive = tab === item.id;
          const showBadge = (item.id === 'orders') && orderUnread > 0;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1 min-h-[56px] relative transition-colors ${
                isActive ? 'text-primary-600' : 'text-neutral-400 active:bg-neutral-50'
              }`}
            >
              <div className="relative">
                {item.icon}
                {showBadge && (
                  <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {orderUnread > 9 ? '9+' : orderUnread}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-semibold leading-none ${isActive ? 'text-primary-600' : 'text-neutral-400'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-600 rounded-full" />
              )}
            </button>
          );
        })}
        {/* Settings slot */}
        <button
          onClick={() => setShowSettings(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1 min-h-[56px] text-neutral-400 active:bg-neutral-50 transition-colors"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-semibold leading-none">More</span>
        </button>
      </nav>

      {/* ── Modals ── */}
      {orderTarget && (
        <NewOrderModal
          lab={orderTarget}
          services={orderServices}
          onClose={() => setOrderTarget(null)}
          onSuccess={() => { setOrderTarget(null); setTab('orders'); }}
        />
      )}
      {quotationTarget && (
        <QuotationModal
          lab={quotationTarget}
          onClose={() => setQuotationTarget(null)}
          onSuccess={() => { setQuotationTarget(null); setTab('quotations'); }}
        />
      )}
      {showSettings && <ProfileSettings onClose={() => setShowSettings(false)} />}

      {quickOrder && (
        <OrderDetailModal
          order={quickOrder}
          isLab={isLab}
          onClose={() => setQuickOrder(null)}
          onStatusChange={() => setQuickOrder(null)}
        />
      )}

      {/* ── Live message toasts (above bottom nav on mobile) ── */}
      <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-5 right-3 md:right-5 z-50 flex flex-col gap-2.5 items-end pointer-events-none">
        {toasts.map(toast => (
          <MessageToast
            key={toast.id}
            toast={toast}
            onOpen={() => { dismissToast(toast.id); handleOpenOrder(toast.notification.related_id!); }}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}

function MessageToast({
  toast, onOpen, onDismiss,
}: {
  toast: LiveToast;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const n = toast.notification;

  return (
    <div
      className={`pointer-events-auto w-72 md:w-80 bg-white rounded-2xl shadow-modal border border-blue-200 overflow-hidden transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="h-1 bg-blue-500" />
      <div className="px-3.5 py-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <MessageCircle className="w-[18px] h-[18px] text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 leading-tight">{n.title}</p>
          {n.body && (
            <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={onOpen}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
            >
              Open
            </button>
            <button onClick={onDismiss} className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
              Dismiss
            </button>
          </div>
        </div>
        <button onClick={onDismiss} className="text-neutral-300 hover:text-neutral-500 transition-colors flex-shrink-0 mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
