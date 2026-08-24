import React, { useRef, useState, useEffect } from 'react';
import { Bell, CheckCheck, Package, MessageSquare, RefreshCw } from 'lucide-react';
import { Notification } from '../lib/supabase';

type NavTarget = 'orders' | 'quotations';

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  new_order:        { icon: <Package className="w-4 h-4" />,       color: 'text-primary-600 bg-primary-50' },
  order_update:     { icon: <RefreshCw className="w-4 h-4" />,     color: 'text-teal-600 bg-teal-50' },
  new_quotation:    { icon: <MessageSquare className="w-4 h-4" />,  color: 'text-amber-600 bg-amber-50' },
  quotation_update: { icon: <MessageSquare className="w-4 h-4" />,  color: 'text-blue-600 bg-blue-50' },
  new_comment:      { icon: <MessageSquare className="w-4 h-4" />,  color: 'text-blue-600 bg-blue-50' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  notifications: Notification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onNavigate: (tab: NavTarget) => void;
  onOpenOrder?: (orderId: string) => void;
}

export default function NotificationBell({
  notifications, unreadCount, onMarkAllRead, onMarkRead, onNavigate, onOpenOrder,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-modal border border-neutral-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-neutral-600" />
              <span className="font-semibold text-neutral-900 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">{unreadCount}</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={onMarkAllRead} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-10">
                <Bell className="w-8 h-8 text-neutral-200 mx-auto mb-2" />
                <p className="text-sm text-neutral-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <NotifItem
                  key={n.id} n={n}
                  onRead={onMarkRead}
                  onNavigate={(tab) => { setOpen(false); onNavigate(tab); }}
                  onOpenOrder={onOpenOrder ? (id) => { setOpen(false); onOpenOrder(id); } : undefined}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const NAV_TARGET: Record<string, NavTarget> = {
  new_order:        'orders',
  order_update:     'orders',
  new_quotation:    'quotations',
  quotation_update: 'quotations',
  new_comment:      'orders',
};

function NotifItem({
  n, onRead, onNavigate, onOpenOrder,
}: {
  n: Notification;
  onRead: (id: string) => void;
  onNavigate: (tab: NavTarget) => void;
  onOpenOrder?: (orderId: string) => void;
}) {
  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.order_update;
  const target = NAV_TARGET[n.type];

  const handleClick = () => {
    if (!n.read) onRead(n.id);
    if (n.type === 'new_comment' && n.related_id && onOpenOrder) {
      onOpenOrder(n.related_id);
    } else if (target) {
      onNavigate(target);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`flex items-start gap-3 px-4 py-3 border-b border-neutral-100 cursor-pointer transition-colors hover:bg-neutral-50 ${!n.read ? 'bg-blue-50/40' : ''}`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-neutral-900 leading-tight">{n.title}</p>
          <span className="text-[10px] text-neutral-400 whitespace-nowrap">{timeAgo(n.created_at)}</span>
        </div>
        {n.body && <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{n.body}</p>}
        {n.type === 'new_comment' && (
          <p className="text-xs text-blue-600 font-medium mt-1">Tap to open conversation</p>
        )}
      </div>
      {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
    </div>
  );
}
