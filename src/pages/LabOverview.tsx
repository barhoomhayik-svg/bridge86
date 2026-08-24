import React, { useEffect, useState, useCallback } from 'react';
import { supabase, Order, OrderStatus, Service } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ClipboardList, Clock, CheckCircle2, XCircle, Loader2, TrendingUp,
  ChevronRight, Package, Image, AlertCircle, CalendarClock, Stethoscope,
  ArrowUpRight, BarChart3, DollarSign, Star,
} from 'lucide-react';
import OrderDetailModal from '../components/OrderDetailModal';

const STATUS_CFG: Record<OrderStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  pending:     { label: 'Pending',     color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: <Clock className="w-4 h-4" /> },
  accepted:    { label: 'Accepted',    color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',    icon: <CheckCircle2 className="w-4 h-4" /> },
  in_progress: { label: 'In Progress', color: 'text-primary-700', bg: 'bg-primary-50', border: 'border-primary-200', icon: <Loader2 className="w-4 h-4" /> },
  completed:   { label: 'Completed',   color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200',    icon: <CheckCircle2 className="w-4 h-4" /> },
  rejected:    { label: 'Rejected',    color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     icon: <XCircle className="w-4 h-4" /> },
  cancelled:   { label: 'Cancelled',   color: 'text-neutral-600', bg: 'bg-neutral-50', border: 'border-neutral-200', icon: <XCircle className="w-4 h-4" /> },
};

interface Props {
  onNavigateOrders: () => void;
}

export default function LabOverview({ onNavigateOrders }: Props) {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: ordersData }, { data: servicesData }, { count }] = await Promise.all([
      supabase
        .from('orders')
        .select('*, from_profile:profiles!orders_from_id_fkey(*), service:services(*), attachments:order_attachments(*)')
        .eq('lab_id', profile.id)
        .order('created_at', { ascending: false }),
      supabase.from('services').select('*').eq('lab_id', profile.id),
      supabase.from('case_photos').select('*', { count: 'exact', head: true }).eq('lab_id', profile.id),
    ]);
    setOrders(ordersData ?? []);
    setServices(servicesData ?? []);
    setPhotoCount(count ?? 0);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived stats
  const counts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeCount = (counts['pending'] ?? 0) + (counts['accepted'] ?? 0) + (counts['in_progress'] ?? 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekOut = new Date(today); weekOut.setDate(today.getDate() + 7);

  const dueSoon = orders.filter(o => {
    if (!o.due_date || ['completed', 'rejected', 'cancelled'].includes(o.status)) return false;
    const d = new Date(o.due_date);
    return d >= today && d <= weekOut;
  }).sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());

  const overdue = orders.filter(o => {
    if (!o.due_date || ['completed', 'rejected', 'cancelled'].includes(o.status)) return false;
    return new Date(o.due_date) < today;
  });

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const recentOrders  = orders.slice(0, 8);

  // This-month completed
  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
  const completedThisMonth = orders.filter(o => o.status === 'completed' && new Date(o.updated_at) >= thisMonth).length;

  // Top clients
  const clientMap: Record<string, { name: string; count: number; city?: string | null; logo?: string | null }> = {};
  for (const o of orders) {
    if (!o.from_profile) continue;
    const k = o.from_id;
    if (!clientMap[k]) clientMap[k] = { name: o.from_profile.name, count: 0, city: o.from_profile.city, logo: o.from_profile.logo_url };
    clientMap[k].count++;
  }
  const topClients = Object.values(clientMap).sort((a, b) => b.count - a.count).slice(0, 5);

  if (loading) return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse shadow-card" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl h-64 animate-pulse shadow-card" />
        <div className="bg-white rounded-2xl h-64 animate-pulse shadow-card" />
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Lab Dashboard</h1>
          <p className="text-neutral-500 text-sm mt-1">Welcome back, {profile?.name}</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-neutral-400">{today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Alert banners */}
      {overdue.length > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium flex-1">
            {overdue.length} order{overdue.length !== 1 ? 's are' : ' is'} overdue and still open
          </p>
          <button onClick={onNavigateOrders} className="text-xs font-semibold text-red-600 hover:text-red-800 flex items-center gap-1">
            View <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {pendingOrders.length > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium flex-1">
            {pendingOrders.length} new order{pendingOrders.length !== 1 ? 's need' : ' needs'} your response
          </p>
          <button onClick={onNavigateOrders} className="text-xs font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1">
            Respond <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<ClipboardList className="w-5 h-5 text-primary-600" />} bg="bg-primary-50"
          value={orders.length} label="Total Orders"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />} bg="bg-blue-50"
          value={activeCount} label="Active" highlight={activeCount > 0}
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-teal-600" />} bg="bg-teal-50"
          value={completedThisMonth} label="Done This Month"
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5 text-violet-600" />} bg="bg-violet-50"
          value={counts['completed'] ?? 0} label="All Completed"
        />
      </div>

      {/* Status strip */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
        {(Object.keys(STATUS_CFG) as OrderStatus[]).map(s => {
          const cfg = STATUS_CFG[s];
          return (
            <button key={s} onClick={onNavigateOrders}
              className={`px-3 py-2.5 rounded-xl text-center transition-all border hover:shadow-card group ${cfg.bg} ${cfg.border}`}
            >
              <p className={`text-lg font-bold ${cfg.color}`}>{counts[s] ?? 0}</p>
              <p className={`text-[10px] font-medium ${cfg.color} opacity-80`}>{cfg.label}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Recent orders */}
        <div className="lg:col-span-2 space-y-5">

          {/* Due soon */}
          {dueSoon.length > 0 && (
            <div className="bg-white rounded-2xl shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4.5 h-4.5 text-amber-500" style={{ width: '18px', height: '18px' }} />
                  <h2 className="font-semibold text-neutral-900 text-sm">Due This Week</h2>
                  <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{dueSoon.length}</span>
                </div>
              </div>
              <div className="space-y-2">
                {dueSoon.map(order => {
                  const cfg = STATUS_CFG[order.status];
                  const dueDate = new Date(order.due_date!);
                  const isToday = dueDate.toDateString() === today.toDateString();
                  const isTomorrow = dueDate.toDateString() === new Date(today.getTime() + 86400000).toDateString();
                  const label = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : dueDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                  return (
                    <button key={order.id} onClick={() => setSelected(order)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-neutral-100 hover:border-primary-200 hover:bg-primary-50/30 transition-all text-left group"
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-neutral-900 text-sm">{order.order_number}</p>
                        <p className="text-xs text-neutral-500 truncate">
                          <span className="font-medium">{order.from_profile?.name ?? '—'}</span> · {order.patient_name}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0 ${isToday ? 'bg-red-100 text-red-700' : isTomorrow ? 'bg-orange-100 text-orange-700' : 'bg-amber-50 text-amber-700'}`}>
                        {label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent orders */}
          <div className="bg-white rounded-2xl shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-neutral-900 text-sm">Recent Orders</h2>
              <button onClick={onNavigateOrders} className="text-xs font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-1">
                All orders <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {recentOrders.length === 0 ? (
              <div className="text-center py-10">
                <ClipboardList className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                <p className="text-neutral-400 text-sm">No orders received yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentOrders.map(order => {
                  const cfg = STATUS_CFG[order.status];
                  return (
                    <button key={order.id} onClick={() => setSelected(order)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-neutral-50 hover:border-primary-100 border border-transparent transition-all text-left group"
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-neutral-900 text-sm">{order.order_number}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>{cfg.label}</span>
                        </div>
                        <p className="text-xs text-neutral-500 truncate mt-0.5">
                          <span className="font-medium">{order.from_profile?.name ?? '—'}</span>
                          {' '}· Patient: {order.patient_name}
                          {order.service && <span className="text-neutral-400"> · {order.service.name}</span>}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-neutral-400">{new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                        {order.due_date && (
                          <p className="text-xs text-amber-600 font-medium">Due {new Date(order.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Profile completeness */}
          <div className="bg-white rounded-2xl shadow-card p-5">
            <h2 className="font-semibold text-neutral-900 text-sm mb-4">Lab Profile</h2>
            <div className="flex items-center gap-4 mb-4">
              {profile?.logo_url ? (
                <img src={profile.logo_url} alt={profile.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-neutral-200" />
              ) : (
                <div className="w-14 h-14 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="w-6 h-6 text-primary-600" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-neutral-900">{profile?.name}</p>
                {profile?.city && <p className="text-xs text-neutral-500 mt-0.5">{profile.city}</p>}
                {profile?.phone && <p className="text-xs text-neutral-400 mt-0.5">{profile.phone}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary-50 rounded-xl p-3 text-center">
                <div className="flex justify-center mb-1"><Package className="w-4 h-4 text-primary-600" /></div>
                <p className="text-xl font-bold text-primary-700">{services.length}</p>
                <p className="text-xs text-primary-600 font-medium">Services</p>
              </div>
              <div className="bg-teal-50 rounded-xl p-3 text-center">
                <div className="flex justify-center mb-1"><Image className="w-4 h-4 text-teal-600" /></div>
                <p className="text-xl font-bold text-teal-700">{photoCount}</p>
                <p className="text-xs text-teal-600 font-medium">Case Photos</p>
              </div>
            </div>
          </div>

          {/* Services quick view */}
          {services.length > 0 && (
            <div className="bg-white rounded-2xl shadow-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-neutral-900 text-sm">Your Services</h2>
                <span className="text-xs text-neutral-400">{services.length} total</span>
              </div>
              <div className="space-y-2">
                {services.slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">{s.name}</p>
                      {s.turnaround_days && (
                        <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />{s.turnaround_days}d turnaround
                        </p>
                      )}
                    </div>
                    {(s.price_from || s.price_to) && (
                      <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {s.price_from && s.price_to ? `${s.price_from}–${s.price_to}` : s.price_from ?? s.price_to}
                      </span>
                    )}
                  </div>
                ))}
                {services.length > 5 && (
                  <p className="text-xs text-neutral-400 pt-1">+{services.length - 5} more services</p>
                )}
              </div>
            </div>
          )}

          {/* Top clients */}
          {topClients.length > 0 && (
            <div className="bg-white rounded-2xl shadow-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400" />
                  <h2 className="font-semibold text-neutral-900 text-sm">Top Clients</h2>
                </div>
              </div>
              <div className="space-y-2.5">
                {topClients.map((c, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {c.logo ? (
                      <img src={c.logo} alt={c.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="w-4 h-4 text-neutral-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">{c.name}</p>
                      {c.city && <p className="text-xs text-neutral-400">{c.city}</p>}
                    </div>
                    <span className="text-xs font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full flex-shrink-0">
                      {c.count} order{c.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <OrderDetailModal
          order={selected}
          isLab={true}
          onClose={() => setSelected(null)}
          onStatusChange={() => { fetchData(); setSelected(null); }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, bg, value, label, highlight }: {
  icon: React.ReactNode; bg: string; value: number; label: string; highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-card ${highlight ? 'ring-2 ring-amber-200' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div>
          <p className={`text-2xl font-bold ${highlight ? 'text-amber-600' : 'text-neutral-900'}`}>{value}</p>
          <p className="text-sm text-neutral-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
