import { useEffect, useState, useCallback } from 'react';
import { supabase, Order, OrderStatus, Profile, Service } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ClipboardList, Clock, CheckCircle2, XCircle, Loader2,
  ChevronRight, Users, Stethoscope, TrendingUp, AlertCircle,
  Plus, Search, Microscope, X,
} from 'lucide-react';
import OrderDetailModal from '../components/OrderDetailModal';
import NewOrderModal from '../components/NewOrderModal';

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  pending:     { label: 'Pending',     color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: <Clock className="w-4 h-4" /> },
  accepted:    { label: 'Accepted',    color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',    icon: <CheckCircle2 className="w-4 h-4" /> },
  in_progress: { label: 'In Progress', color: 'text-primary-700', bg: 'bg-primary-50', border: 'border-primary-200', icon: <Loader2 className="w-4 h-4" /> },
  completed:   { label: 'Completed',   color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200',    icon: <CheckCircle2 className="w-4 h-4" /> },
  rejected:    { label: 'Rejected',    color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     icon: <XCircle className="w-4 h-4" /> },
  cancelled:   { label: 'Cancelled',   color: 'text-neutral-600', bg: 'bg-neutral-50', border: 'border-neutral-200', icon: <XCircle className="w-4 h-4" /> },
};

export default function CenterDashboard() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [selected, setSelected] = useState<Order | null>(null);
  const [showLabPicker, setShowLabPicker] = useState(false);
  const [orderTarget, setOrderTarget] = useState<Profile | null>(null);
  const [orderServices, setOrderServices] = useState<Service[]>([]);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const { data: memberRows } = await supabase
      .from('center_members')
      .select('doctor_id, doctor_profile:profiles!center_members_doctor_id_fkey(*)')
      .eq('center_id', profile.id);

    const doctorProfiles = (memberRows ?? []).map((r: { doctor_id: string; doctor_profile: Profile | Profile[] }) => {
      const p = Array.isArray(r.doctor_profile) ? r.doctor_profile[0] : r.doctor_profile;
      return p;
    }).filter(Boolean) as Profile[];
    setMembers(doctorProfiles);

    const senderIds = [profile.id, ...(memberRows ?? []).map((r: { doctor_id: string }) => r.doctor_id)];

    const { data: orderData } = await supabase
      .from('orders')
      .select('*, from_profile:profiles!orders_from_id_fkey(*), lab_profile:profiles!orders_lab_id_fkey(*), service:services(*), attachments:order_attachments(*)')
      .in('from_id', senderIds)
      .order('created_at', { ascending: false });

    setOrders(orderData ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSelectLab = async (lab: Profile) => {
    const { data: services } = await supabase.from('services').select('*').eq('lab_id', lab.id);
    setOrderServices(services ?? []);
    setOrderTarget(lab);
    setShowLabPicker(false);
  };

  const counts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeCount = (counts['pending'] ?? 0) + (counts['accepted'] ?? 0) + (counts['in_progress'] ?? 0);
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Center Dashboard</h1>
          <p className="text-neutral-500 text-sm mt-1">All orders placed by your center and team doctors</p>
        </div>
        <button
          onClick={() => setShowLabPicker(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Order</span>
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<ClipboardList className="w-5 h-5 text-primary-600" />}
          bg="bg-primary-50"
          value={orders.length}
          label="Total Orders"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          bg="bg-blue-50"
          value={activeCount}
          label="Active"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-teal-600" />}
          bg="bg-teal-50"
          value={counts['completed'] ?? 0}
          label="Completed"
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-violet-600" />}
          bg="bg-violet-50"
          value={members.length}
          label="Team Doctors"
        />
      </div>

      {/* Status filter strip */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">
        {(Object.keys(STATUS_CONFIG) as OrderStatus[]).map(s => {
          const cfg = STATUS_CONFIG[s];
          const active = filter === s;
          return (
            <button
              key={s}
              onClick={() => setFilter(active ? 'all' : s)}
              className={`px-3 py-2.5 rounded-xl text-center transition-all border ${
                active
                  ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                  : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300'
              }`}
            >
              <p className="text-lg font-bold">{counts[s] ?? 0}</p>
              <p className="text-[10px] font-medium">{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl h-20 animate-pulse shadow-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-card border border-neutral-100">
          {orders.length === 0 ? (
            <>
              <AlertCircle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500 font-medium">No orders yet</p>
              <p className="text-neutral-400 text-sm mt-1 mb-4">
                {members.length === 0
                  ? 'Add doctors to your team and place orders to see them here'
                  : 'Your center or team doctors have not placed any orders yet'}
              </p>
              <button
                onClick={() => setShowLabPicker(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" /> Place First Order
              </button>
            </>
          ) : (
            <>
              <ClipboardList className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500 font-medium">No {STATUS_CONFIG[filter as OrderStatus]?.label} orders</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => {
            const cfg = STATUS_CONFIG[order.status];
            const isFromCenter = order.from_id === profile?.id;
            return (
              <button
                key={order.id}
                onClick={() => setSelected(order)}
                className="w-full bg-white rounded-xl p-4 shadow-card hover:shadow-card-hover transition-all text-left flex items-center gap-4 group border border-transparent hover:border-primary-100"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-neutral-900 text-sm">{order.order_number}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                      {cfg.label}
                    </span>
                    {!isFromCenter && (
                      <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        <Stethoscope className="w-3 h-3" />
                        {order.from_profile?.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-600 truncate">
                    To: <span className="font-medium">{order.lab_profile?.name ?? '—'}</span>
                    {' '}&bull; Patient: {order.patient_name}
                    {' '}&bull; Dr. {order.dr_name}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">File #{order.file_number}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-neutral-400">{new Date(order.created_at).toLocaleDateString()}</p>
                  {order.due_date && (
                    <p className="text-xs text-amber-600 font-medium">
                      Due {new Date(order.due_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-primary-500 transition-colors ml-1" />
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <OrderDetailModal
          order={selected}
          isLab={false}
          onClose={() => setSelected(null)}
          onStatusChange={() => { fetchData(); setSelected(null); }}
        />
      )}

      {showLabPicker && (
        <LabPickerModal
          onSelect={handleSelectLab}
          onClose={() => setShowLabPicker(false)}
        />
      )}

      {orderTarget && (
        <NewOrderModal
          lab={orderTarget}
          services={orderServices}
          onClose={() => setOrderTarget(null)}
          onSuccess={() => { setOrderTarget(null); fetchData(); }}
        />
      )}
    </div>
  );
}

/* ─── Lab Picker Modal ─────────────────────────────────────────────────────── */

function LabPickerModal({ onSelect, onClose }: { onSelect: (lab: Profile) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [labs, setLabs] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role', 'lab').order('name').then(({ data }) => {
      setLabs(data ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = labs.filter(l =>
    !search.trim() || l.name.toLowerCase().includes(search.toLowerCase()) || (l.city ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-neutral-200">
          <div>
            <h2 className="font-bold text-neutral-900">Select a Lab</h2>
            <p className="text-sm text-neutral-500">Choose the lab to place an order with</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search lab by name or city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loading ? (
            <div className="space-y-2 pt-2">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-neutral-100 rounded-xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <Microscope className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
              <p className="text-neutral-500 text-sm">No labs found</p>
            </div>
          ) : (
            <div className="space-y-1.5 pt-2">
              {filtered.map(lab => (
                <button
                  key={lab.id}
                  onClick={() => onSelect(lab)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-primary-50 hover:border-primary-200 border border-transparent transition-all text-left group"
                >
                  {lab.logo_url ? (
                    <img src={lab.logo_url} alt={lab.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
                      <Microscope className="w-5 h-5 text-primary-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-neutral-900 text-sm">{lab.name}</p>
                    {lab.city && <p className="text-xs text-neutral-500">{lab.city}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-primary-500 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function StatCard({ icon, bg, value, label }: { icon: React.ReactNode; bg: string; value: number; label: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-card">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-neutral-900">{value}</p>
          <p className="text-sm text-neutral-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
