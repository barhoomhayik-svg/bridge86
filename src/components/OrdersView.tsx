import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, Order, OrderStatus } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Clock, CheckCircle2, XCircle, Loader2, ChevronRight, Search, X, Stethoscope, MessageSquare } from 'lucide-react';
import OrderDetailModal from './OrderDetailModal';

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:     { label: 'Pending',     color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',      icon: <Clock className="w-3.5 h-3.5" /> },
  accepted:    { label: 'Accepted',    color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',        icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  in_progress: { label: 'In Progress', color: 'text-primary-700', bg: 'bg-primary-50 border-primary-200',  icon: <Loader2 className="w-3.5 h-3.5" /> },
  completed:   { label: 'Completed',   color: 'text-teal-700',    bg: 'bg-teal-50 border-teal-200',        icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected:    { label: 'Rejected',    color: 'text-red-700',     bg: 'bg-red-50 border-red-200',          icon: <XCircle className="w-3.5 h-3.5" /> },
  cancelled:   { label: 'Cancelled',   color: 'text-neutral-600', bg: 'bg-neutral-50 border-neutral-200',  icon: <XCircle className="w-3.5 h-3.5" /> },
};

interface Props { viewAs?: 'sender' | 'lab' }

export default function OrdersView({ viewAs }: Props) {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [unreadOrders, setUnreadOrders] = useState<Set<string>>(new Set());
  const ordersRef = useRef<Order[]>([]);

  const isLab = viewAs === 'lab' || profile?.role === 'lab';
  const isCenter = profile?.role === 'center';

  const fetchOrders = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    let senderIds: string[] = [profile.id];

    if (isCenter) {
      const { data: members } = await supabase
        .from('center_members')
        .select('doctor_id')
        .eq('center_id', profile.id);
      if (members?.length) {
        senderIds = [profile.id, ...members.map((m: { doctor_id: string }) => m.doctor_id)];
      }
    }

    let query = supabase
      .from('orders')
      .select('*, from_profile:profiles!orders_from_id_fkey(*), lab_profile:profiles!orders_lab_id_fkey(*), service:services(*), attachments:order_attachments(*)')
      .order('created_at', { ascending: false });

    if (isLab) query = query.eq('lab_id', profile.id);
    else if (senderIds.length > 1) query = query.in('from_id', senderIds);
    else query = query.eq('from_id', profile.id);

    const { data } = await query;
    const fetched = data ?? [];
    setOrders(fetched);
    ordersRef.current = fetched;
    setLoading(false);
    return fetched;
  }, [profile, isLab, isCenter]);

  const fetchUnread = useCallback(async (orderList?: Order[]) => {
    if (!profile) return;
    const list = orderList ?? ordersRef.current;
    if (!list.length) return;

    const orderIds = list.map(o => o.id);

    const [{ data: reads }, { data: comments }] = await Promise.all([
      supabase
        .from('order_comment_reads')
        .select('order_id, last_read_at')
        .eq('user_id', profile.id)
        .in('order_id', orderIds),
      supabase
        .from('order_comments')
        .select('order_id, created_at')
        .in('order_id', orderIds)
        .neq('author_id', profile.id)
        .order('created_at', { ascending: false }),
    ]);

    const readMap = new Map((reads ?? []).map(r => [r.order_id, r.last_read_at]));

    // latest non-own comment per order
    const latestPerOrder = new Map<string, string>();
    for (const c of (comments ?? [])) {
      if (!latestPerOrder.has(c.order_id)) latestPerOrder.set(c.order_id, c.created_at);
    }

    const unread = new Set<string>();
    for (const [orderId, latestAt] of latestPerOrder) {
      const lastRead = readMap.get(orderId);
      if (!lastRead || latestAt > lastRead) unread.add(orderId);
    }
    setUnreadOrders(unread);
  }, [profile]);

  useEffect(() => {
    fetchOrders().then(list => { if (list) fetchUnread(list); });
  }, [fetchOrders, fetchUnread]);

  // Realtime: mark order as unread when a new comment arrives (while modal is closed)
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('orders_view_comments')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_comments',
      }, (payload) => {
        const { order_id, author_id } = payload.new as { order_id: string; author_id: string };
        if (author_id === profile.id) return; // own message, ignore
        // only if we have this order in our list and modal is not open for it
        const inList = ordersRef.current.some(o => o.id === order_id);
        if (!inList) return;
        setUnreadOrders(prev => {
          if (prev.has(order_id)) return prev;
          const next = new Set(prev);
          next.add(order_id);
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const handleRead = (orderId: string) => {
    setUnreadOrders(prev => {
      if (!prev.has(orderId)) return prev;
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  };

  const filtered = orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.patient_name.toLowerCase().includes(q) ||
        o.file_number.toLowerCase().includes(q) ||
        o.dr_name.toLowerCase().includes(q) ||
        (o.from_profile?.name ?? '').toLowerCase().includes(q) ||
        (o.lab_profile?.name ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalUnread = unreadOrders.size;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-900">{isLab ? 'Incoming Orders' : isCenter ? 'Team Orders' : 'My Orders'}</h1>
            {totalUnread > 0 && (
              <span className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                <MessageSquare className="w-3 h-3" />
                {totalUnread} unread
              </span>
            )}
          </div>
          <p className="text-neutral-500 text-sm mt-0.5">{orders.length} total</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Search by patient name, file number, doctor, order number..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-card"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Status filter strip */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">
        {(Object.keys(STATUS_CONFIG) as OrderStatus[]).map(s => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button key={s} onClick={() => setFilter(filter === s ? 'all' : s)}
              className={`px-3 py-2.5 rounded-xl text-center transition-all border ${filter === s ? cfg.bg + ' ' + cfg.color + ' border-current' : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300'}`}
            >
              <p className="text-lg font-bold">{counts[s] ?? 0}</p>
              <p className="text-[10px] font-medium">{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl h-20 animate-pulse shadow-card" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500 font-medium">
            {search ? `No orders matching "${search}"` : 'No orders yet'}
          </p>
          <p className="text-neutral-400 text-sm">
            {!search && (isLab ? 'Orders from centers and doctors will appear here' : 'Find a lab and place your first order')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => {
            const cfg = STATUS_CONFIG[order.status];
            const other = isLab ? order.from_profile : order.lab_profile;
            const hasUnread = unreadOrders.has(order.id);
            return (
              <button key={order.id} onClick={() => setSelected(order)}
                className={`w-full bg-white rounded-xl p-4 shadow-card hover:shadow-card-hover transition-all text-left flex items-center gap-4 group border ${
                  hasUnread ? 'border-blue-200 bg-blue-50/30' : 'border-transparent hover:border-primary-100'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color} border`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-neutral-900 text-sm">{order.order_number}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    {hasUnread && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                        New message
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-600 truncate">
                    {isLab ? 'From' : 'To'}: <span className="font-medium">{other?.name ?? '—'}</span>
                    {' '}&bull; Patient: {order.patient_name}
                    {' '}&bull; Dr. {order.dr_name}
                  </p>
                  {isCenter && order.from_profile?.id !== profile?.id && (
                    <p className="text-xs mt-0.5 flex items-center gap-1 text-blue-600">
                      <Stethoscope className="w-3 h-3" />
                      {order.from_profile?.name}
                    </p>
                  )}
                  <p className="text-xs text-neutral-400 mt-0.5">File #{order.file_number}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-neutral-400">{new Date(order.created_at).toLocaleDateString()}</p>
                  {order.due_date && <p className="text-xs text-amber-600 font-medium">Due {new Date(order.due_date).toLocaleDateString()}</p>}
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
          isLab={isLab}
          onClose={() => setSelected(null)}
          onStatusChange={() => { fetchOrders(); setSelected(null); }}
          onRead={handleRead}
        />
      )}
    </div>
  );
}
