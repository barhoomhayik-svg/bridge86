import React, { useState, useEffect, useRef } from 'react';
import { supabase, Order, OrderStatus, OrderComment } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Paperclip, User, FileText, Palette, Grid3x3, Calendar, MessageSquare, CheckCircle2, Printer, Send } from 'lucide-react';

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:     ['accepted', 'rejected'],
  accepted:    ['in_progress', 'rejected'],
  in_progress: ['completed'],
  completed:   [],
  rejected:    [],
  cancelled:   [],
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending', accepted: 'Accepted', in_progress: 'In Progress',
  completed: 'Completed', rejected: 'Rejected', cancelled: 'Cancelled',
};

const statusColor: Record<OrderStatus, string> = {
  pending:     'bg-amber-50 text-amber-700 border-amber-200',
  accepted:    'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-primary-50 text-primary-700 border-primary-200',
  completed:   'bg-teal-50 text-teal-700 border-teal-200',
  rejected:    'bg-red-50 text-red-700 border-red-200',
  cancelled:   'bg-neutral-100 text-neutral-600 border-neutral-200',
};

// ─── Print HTML generator ───────────────────────────────────────────────────────

function generatePrintHTML(order: Order, comments: OrderComment[]): string {
  const fromName   = order.from_profile?.name ?? '—';
  const labName    = order.lab_profile?.name  ?? '—';
  const fromCity    = order.from_profile?.city    ?? '';
  const labCity     = order.lab_profile?.city     ?? '';
  const fromPhone   = order.from_profile?.phone   ?? '';
  const labPhone    = order.lab_profile?.phone    ?? '';
  const fromLogo    = order.from_profile?.logo_url ?? '';
  const labLogo     = order.lab_profile?.logo_url  ?? '';
  const fromAddress = order.from_profile?.address ?? '';
  const labAddress  = order.lab_profile?.address  ?? '';

  const selected = new Set<number>(
    (order.teeth_numbers ?? '').split(/[,\s]+/)
      .map(t => parseInt(t.trim()))
      .filter(n => !isNaN(n))
  );

  const statusColors: Record<OrderStatus, { bg: string; text: string; border: string }> = {
    pending:     { bg: '#fffbeb', text: '#b45309', border: '#fcd34d' },
    accepted:    { bg: '#eff6ff', text: '#1d4ed8', border: '#93c5fd' },
    in_progress: { bg: '#eff6ff', text: '#1d4ed8', border: '#60a5fa' },
    completed:   { bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
    rejected:    { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
    cancelled:   { bg: '#f5f5f5', text: '#525252', border: '#d4d4d4' },
  };
  const sc = statusColors[order.status] ?? statusColors.pending;

  const row3 = (a: string, av: string, b: string, bv: string, c: string, cv: string) =>
    `<tr><td class="lbl">${a}</td><td class="val">${av}</td><td class="lbl">${b}</td><td class="val">${bv}</td><td class="lbl">${c}</td><td class="val">${cv}</td></tr>`;

  const attachRows = order.attachments && order.attachments.length > 0
    ? order.attachments.map(a =>
        `<div class="att-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="flex-shrink:0"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.file_name}</span>
          ${a.file_size ? `<span style="color:#94a3b8;white-space:nowrap">${(a.file_size/1024).toFixed(1)} KB</span>` : ''}
        </div>`).join('')
    : '<p style="color:#94a3b8;font-size:11px;margin:0">No attachments</p>';

  const partyCard = (logo: string, label: string, name: string, address: string, city: string, phone: string) => `
    <div class="party-card">
      <div class="party-label">${label}</div>
      <div class="party-inner">
        ${logo ? `<img src="${logo}" class="party-logo" alt="logo"/>` : `<div class="party-avatar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg></div>`}
        <div>
          <div class="party-name">${name}</div>
          ${address ? `<div class="party-sub">${address}${city ? ', ' + city : ''}</div>` : city ? `<div class="party-sub">${city}</div>` : ''}
          ${phone ? `<div class="party-sub">${phone}</div>` : ''}
        </div>
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Dental Lab Order — ${order.order_number}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @page { size: A4 portrait; margin: 1.8cm 1.8cm 1.8cm 1.8cm; }

  html { width: 210mm; }
  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    font-size: 11px;
    color: #0f172a;
    background: #fff;
    width: 100%;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Header ── */
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 14px; border-bottom: 2.5px solid #2563eb; margin-bottom: 18px;
  }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-icon {
    width: 38px; height: 38px; background: #2563eb; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
  }
  .brand-name { font-size: 20px; font-weight: 800; color: #1e3a8a; letter-spacing: -0.5px; }
  .brand-tag  { font-size: 9px; color: #64748b; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; }
  .header-right { text-align: right; }
  .order-num { font-size: 17px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px; }
  .order-date { font-size: 10px; color: #64748b; margin-top: 2px; }
  .status-badge {
    display: inline-block; margin-top: 5px;
    padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.6px; border: 1px solid;
    background: ${sc.bg}; color: ${sc.text}; border-color: ${sc.border};
  }

  /* ── Parties ── */
  .parties { display: grid; grid-template-columns: 1fr 40px 1fr; gap: 10px; align-items: center; margin-bottom: 16px; }
  .party-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
  .party-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; }
  .party-inner { display: flex; align-items: center; gap: 10px; }
  .party-logo { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
  .party-avatar { width: 36px; height: 36px; background: #eff6ff; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .party-name { font-size: 13px; font-weight: 700; color: #0f172a; }
  .party-sub  { font-size: 10px; color: #64748b; margin-top: 1px; }
  .arrow-box { display: flex; justify-content: center; align-items: center; }

  /* ── Section title ── */
  .section { margin-bottom: 14px; }
  .section-title {
    font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
    color: #94a3b8; margin-bottom: 8px; padding-bottom: 5px;
    border-bottom: 1px solid #f1f5f9;
  }

  /* ── Patient table ── */
  .patient-table { width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
  .patient-table tr:not(:last-child) { border-bottom: 1px solid #e2e8f0; }
  .patient-table td { padding: 8px 12px; }
  .patient-table td.lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #94a3b8; white-space: nowrap; width: 80px; }
  .patient-table td.val { font-size: 12px; font-weight: 600; color: #0f172a; }
  .patient-table td.lbl:nth-child(3), .patient-table td.lbl:nth-child(5) { border-left: 1px solid #e2e8f0; }

  /* ── Teeth badges ── */
  .chart-wrapper {
    border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;
    background: #fff;
  }
  .chart-header {
    background: #f8fafc; border-bottom: 1px solid #e2e8f0;
    padding: 7px 14px; font-size: 8.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1px; color: #64748b;
    display: flex; justify-content: space-between; align-items: center;
  }
  .chart-body { padding: 10px 14px; }
  .teeth-rows { display: flex; flex-direction: column; gap: 6px; }
  .teeth-row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .teeth-row-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; width: 52px; flex-shrink: 0; }
  .teeth-divider { width: 10px; flex-shrink: 0; }
  .t { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; font-size: 10px; font-weight: 500; border: 1px solid #d1d5db; background: #f9fafb; color: #374151; }
  .t.sel { background: #2563eb; border-color: #1d4ed8; color: #fff; font-weight: 700; }

  /* ── Notes ── */
  .notes-box {
    background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 12px;
    font-size: 12px; color: #78350f; line-height: 1.6; word-break: break-word; white-space: pre-wrap;
  }

  /* ── Attachments ── */
  .att-list { display: flex; flex-direction: column; gap: 4px; }
  .att-item {
    display: flex; align-items: center; gap: 8px;
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
    padding: 6px 10px; font-size: 11px; color: #334155;
  }

  /* ── Page break helpers ── */
  .section { margin-bottom: 14px; page-break-inside: avoid; }
  .chart-wrapper { page-break-inside: avoid; }
  .parties { page-break-inside: avoid; }

  /* ── Footer / Signatures ── */
  .footer { margin-top: 20px; padding-top: 14px; border-top: 1px solid #e2e8f0; page-break-inside: avoid; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-bottom: 12px; }
  .sig-box { }
  .sig-line { border-top: 1.5px solid #cbd5e1; padding-top: 5px; margin-top: 28px; }
  .sig-label { font-size: 9px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .footer-meta { display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }

  /* ── Print overrides ── */
  @media print {
    body { padding: 0; }
    .chart-wrapper, .patient-table, .party-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    svg { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }

  /* ── Conversation ── */
  .conv-list { display: flex; flex-direction: column; gap: 8px; }
  .msg { border-radius: 10px; padding: 9px 12px; border: 1px solid; max-width: 100%; page-break-inside: avoid; }
  .msg-clinic { background: #f0f9ff; border-color: #bae6fd; }
  .msg-lab    { background: #f0fdf4; border-color: #bbf7d0; }
  .msg-header { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
  .msg-avatar {
    width: 22px; height: 22px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0;
  }
  .msg-avatar-clinic { background: #2563eb; }
  .msg-avatar-lab    { background: #16a34a; }
  .msg-sender { font-size: 10px; font-weight: 700; color: #374151; }
  .msg-role   { font-size: 9px; color: #94a3b8; font-weight: 500; }
  .msg-time   { margin-left: auto; font-size: 9px; color: #94a3b8; white-space: nowrap; }
  .msg-body   { font-size: 11px; color: #1e293b; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
  .conv-empty { color: #94a3b8; font-size: 11px; text-align: center; padding: 12px 0; font-style: italic; }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="brand">
    <div class="brand-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 15.54a5 5 0 0 1 0-7.07"/>
      </svg>
    </div>
    <div>
      <div class="brand-name">Bridge</div>
      <div class="brand-tag">Lab Order Form</div>
    </div>
  </div>
  <div class="header-right">
    <div class="order-num">${order.order_number}</div>
    <div class="order-date">Issued: ${new Date(order.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</div>
    <div><span class="status-badge">${STATUS_LABELS[order.status]}</span></div>
  </div>
</div>

<!-- PARTIES -->
<div class="parties">
  ${partyCard(fromLogo, 'Ordering Clinic / Doctor', fromName, fromAddress, fromCity, fromPhone)}
  <div class="arrow-box">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>
    </svg>
  </div>
  ${partyCard(labLogo, 'Dental Laboratory', labName, labAddress, labCity, labPhone)}
</div>

<!-- PATIENT DETAILS -->
<div class="section">
  <div class="section-title">Patient &amp; Case Information</div>
  <table class="patient-table">
    <tbody>
      ${row3('File No.', order.file_number, 'Patient Name', order.patient_name, 'Doctor', order.dr_name)}
      ${row3('Shade', order.shade ?? '—', 'Service', order.service?.name ?? '—', 'Due Date', order.due_date ? new Date(order.due_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—')}
      ${(order.service?.price_from || order.service?.price_to || order.service?.turnaround_days || order.teeth_numbers)
        ? row3(
            'Price Range',
            order.service?.price_from || order.service?.price_to
              ? (order.service.price_from && order.service.price_to
                  ? `$${order.service.price_from} – $${order.service.price_to}`
                  : order.service.price_from ? `From $${order.service.price_from}` : `Up to $${order.service.price_to}`)
              : '—',
            'Turnaround',
            order.service?.turnaround_days ? `${order.service.turnaround_days} days` : '—',
            'Teeth (FDI)',
            order.teeth_numbers ?? '—'
          )
        : ''}
    </tbody>
  </table>
</div>

<!-- DENTAL CHART -->
<div class="section">
  <div class="section-title">Dental Chart</div>
  <div class="chart-wrapper">
    <div class="chart-header">
      <span>Teeth — FDI Notation</span>
      ${selected.size > 0
        ? `<span style="font-size:10px;color:#2563eb;font-weight:600">Selected: ${Array.from(selected).sort((a,b)=>a-b).join(', ')}</span>`
        : '<span style="font-size:10px;color:#94a3b8;font-weight:400">No specific teeth selected</span>'}
    </div>
    <div class="chart-body">
      <div class="teeth-rows">
        <div class="teeth-row">
          <span class="teeth-row-label">Upper R</span>
          ${[18,17,16,15,14,13,12,11].map(n=>`<span class="t${selected.has(n)?' sel':''}">${n}</span>`).join('')}
          <span class="teeth-divider"></span>
          ${[21,22,23,24,25,26,27,28].map(n=>`<span class="t${selected.has(n)?' sel':''}">${n}</span>`).join('')}
          <span class="teeth-row-label" style="text-align:right">Upper L</span>
        </div>
        <div class="teeth-row">
          <span class="teeth-row-label">Lower R</span>
          ${[48,47,46,45,44,43,42,41].map(n=>`<span class="t${selected.has(n)?' sel':''}">${n}</span>`).join('')}
          <span class="teeth-divider"></span>
          ${[31,32,33,34,35,36,37,38].map(n=>`<span class="t${selected.has(n)?' sel':''}">${n}</span>`).join('')}
          <span class="teeth-row-label" style="text-align:right">Lower L</span>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- NOTES -->
${order.notes ? `
<div class="section">
  <div class="section-title">Clinical Notes &amp; Instructions</div>
  <div class="notes-box">${order.notes}</div>
</div>` : ''}

<!-- ATTACHMENTS -->
<div class="section">
  <div class="section-title">Attachments (${order.attachments?.length ?? 0} file${(order.attachments?.length ?? 0) !== 1 ? 's' : ''})</div>
  <div class="att-list">${attachRows}</div>
</div>

<!-- CONVERSATION -->
<div class="section">
  <div class="section-title">Conversation (${comments.length} message${comments.length !== 1 ? 's' : ''})</div>
  ${comments.length === 0
    ? '<div class="conv-empty">No messages in this order conversation.</div>'
    : `<div class="conv-list">
        ${comments.map(c => {
          const isClinic = c.author_id === order.from_id;
          const cls      = isClinic ? 'msg-clinic' : 'msg-lab';
          const avCls    = isClinic ? 'msg-avatar-clinic' : 'msg-avatar-lab';
          const roleTag  = isClinic ? 'Clinic' : 'Lab';
          const initials = (c.author?.name ?? '?').charAt(0).toUpperCase();
          const dt = new Date(c.created_at);
          const dateStr  = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          const timeStr  = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const isRtl    = /[\u0600-\u06FF]/.test(c.body);
          return `<div class="msg ${cls}">
            <div class="msg-header">
              <div class="msg-avatar ${avCls}">${initials}</div>
              <span class="msg-sender">${c.author?.name ?? '—'}</span>
              <span class="msg-role">${roleTag}</span>
              <span class="msg-time">${dateStr} ${timeStr}</span>
            </div>
            <div class="msg-body" ${isRtl ? 'dir="rtl" style="text-align:right"' : ''}>${c.body.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          </div>`;
        }).join('')}
       </div>`
  }
</div>

<!-- SIGNATURES / FOOTER -->
<div class="footer">
  <div class="sig-grid">
    <div class="sig-box">
      <div class="sig-line"><div class="sig-label">Authorized By (Clinic / Doctor)</div></div>
    </div>
    <div class="sig-box">
      <div class="sig-line"><div class="sig-label">Received By (Lab)</div></div>
    </div>
    <div class="sig-box">
      <div class="sig-line"><div class="sig-label">Delivery Date</div></div>
    </div>
  </div>
  <div class="footer-meta">
    <span>Generated: ${new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
    <span>Bridge — Lab Ordering Platform &nbsp;·&nbsp; ${order.order_number}</span>
  </div>
</div>

</body>
</html>`;
}

// ─── React component ────────────────────────────────────────────────────────────

interface Props {
  order: Order;
  isLab: boolean;
  onClose: () => void;
  onStatusChange: () => void;
  onRead?: (orderId: string) => void;
}

export default function OrderDetailModal({ order, isLab, onClose, onStatusChange, onRead }: Props) {
  const { profile } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [comments, setComments] = useState<OrderComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const transitions = isLab
    ? STATUS_TRANSITIONS[order.status]
    : (order.status === 'pending' ? ['cancelled' as OrderStatus] : []);

  const markRead = async () => {
    if (!profile) return;
    await supabase
      .from('order_comment_reads')
      .upsert({ user_id: profile.id, order_id: order.id, last_read_at: new Date().toISOString() });
    onRead?.(order.id);
  };

  useEffect(() => {
    const fetchComments = async () => {
      const { data } = await supabase
        .from('order_comments')
        .select('*, author:profiles(id, name, role)')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });
      if (data) setComments(data as OrderComment[]);
    };

    fetchComments();
    markRead();

    const channel = supabase
      .channel(`order_comments:${order.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_comments',
        filter: `order_id=eq.${order.id}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('order_comments')
          .select('*, author:profiles(id, name, role)')
          .eq('id', (payload.new as { id: string }).id)
          .maybeSingle();
        if (data) {
          setComments(prev => [...prev, data as OrderComment]);
          markRead();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const submitComment = async () => {
    if (!newComment.trim() || !profile || submitting) return;
    setSubmitting(true);
    const body = newComment.trim();
    setNewComment('');
    const { error: insertErr } = await supabase
      .from('order_comments')
      .insert({ order_id: order.id, author_id: profile.id, body });
    if (insertErr) setNewComment(body);
    setSubmitting(false);
  };

  const updateStatus = async (status: OrderStatus) => {
    setUpdating(true);
    setError('');
    const { error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', order.id);
    setUpdating(false);
    if (error) { setError(error.message); return; }
    onStatusChange();
  };

  const handlePrint = () => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(generatePrintHTML(order, comments));
    doc.close();
    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 600);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="font-bold text-neutral-900 text-base">{order.order_number}</h2>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor[order.status]}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 text-xs font-semibold rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print / PDF
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT — order details */}
          <div className="w-[52%] border-r border-neutral-200 overflow-y-auto p-5 space-y-4 flex-shrink-0">

            <div className="grid grid-cols-2 gap-3">
              <InfoCard icon={<User className="w-4 h-4" />} label="From" value={order.from_profile?.name ?? '—'} sub={order.from_profile?.city} />
              <InfoCard icon={<User className="w-4 h-4" />} label="Lab"  value={order.lab_profile?.name  ?? '—'} sub={order.lab_profile?.city} />
            </div>

            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Patient Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <Detail icon={<FileText    className="w-4 h-4" />} label="File No."      value={order.file_number} />
                <Detail icon={<User        className="w-4 h-4" />} label="Patient"       value={order.patient_name} />
                <Detail icon={<User        className="w-4 h-4" />} label="Doctor"        value={order.dr_name} />
                {order.shade         && <Detail icon={<Palette      className="w-4 h-4" />} label="Shade"        value={order.shade} />}
                {order.teeth_numbers && <Detail icon={<Grid3x3     className="w-4 h-4" />} label="Teeth"        value={order.teeth_numbers} />}
                {order.due_date      && <Detail icon={<Calendar     className="w-4 h-4" />} label="Due Date"     value={new Date(order.due_date).toLocaleDateString()} />}
                {order.service       && <Detail icon={<CheckCircle2 className="w-4 h-4" />} label="Service"      value={order.service.name} />}
              </div>
            </div>

            {order.notes && (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <div className="flex items-center gap-2 mb-1.5">
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Notes</span>
                </div>
                <p className="text-sm text-amber-900 leading-relaxed">{order.notes}</p>
              </div>
            )}

            {order.attachments && order.attachments.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Attachments</h3>
                <div className="space-y-1.5">
                  {order.attachments.map(att => (
                    <a key={att.id} href={att.file_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 bg-neutral-50 rounded-lg border border-neutral-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-sm"
                    >
                      <Paperclip className="w-4 h-4 text-neutral-400" />
                      <span className="flex-1 truncate text-neutral-700">{att.file_name}</span>
                      {att.file_size && <span className="text-xs text-neutral-400">{(att.file_size / 1024).toFixed(1)} KB</span>}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-neutral-400 space-y-1 pt-1">
              <p>Created: {new Date(order.created_at).toLocaleString()}</p>
              <p>Updated: {new Date(order.updated_at).toLocaleString()}</p>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            {transitions.length > 0 && (
              <div className="flex gap-2 flex-wrap pt-1">
                {transitions.map(status => {
                  const isPositive = ['accepted', 'in_progress', 'completed'].includes(status);
                  return (
                    <button key={status} onClick={() => updateStatus(status)} disabled={updating}
                      className={`flex-1 min-w-0 py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 ${
                        isPositive
                          ? 'bg-primary-600 hover:bg-primary-700 text-white'
                          : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                      }`}
                    >
                      {updating ? '...' : STATUS_LABELS[status]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT — conversation */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chat header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-primary-600" />
              <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Conversation</span>
              {comments.length > 0 && (
                <span className="ml-auto bg-neutral-200 text-neutral-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {comments.length}
                </span>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center mb-3">
                    <MessageSquare className="w-6 h-6 text-primary-300" />
                  </div>
                  <p className="text-sm font-medium text-neutral-500">No messages yet</p>
                  <p className="text-xs text-neutral-400 mt-1">Start the conversation below</p>
                </div>
              ) : (
                comments.map(c => {
                  const isOwn = c.author_id === profile?.id;
                  const isRtl = /[\u0600-\u06FF]/.test(c.body);
                  const time = new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const date = new Date(c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
                  return (
                    <div key={c.id} className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      {!isOwn && (
                        <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="w-3.5 h-3.5 text-primary-600" />
                        </div>
                      )}
                      <div className={`max-w-[78%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                        <span className="text-[11px] text-neutral-400 mb-1 px-1">
                          {isOwn ? 'You' : (c.author?.name ?? '—')} · {date} {time}
                        </span>
                        <div
                          dir={isRtl ? 'rtl' : 'ltr'}
                          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
                            isRtl ? 'text-right' : 'text-left'
                          } ${
                            isOwn
                              ? 'bg-primary-600 text-white rounded-br-sm'
                              : 'bg-neutral-100 text-neutral-900 rounded-bl-sm'
                          }`}
                        >
                          {c.body}
                        </div>
                      </div>
                      {isOwn && (
                        <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-neutral-200 p-3 flex gap-2 bg-neutral-50 flex-shrink-0">
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitComment();
                  }
                }}
                dir={/[\u0600-\u06FF]/.test(newComment) ? 'rtl' : 'ltr'}
                placeholder="Write a message... (Enter to send)"
                rows={2}
                className="flex-1 resize-none text-sm border border-neutral-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-neutral-400"
              />
              <button
                onClick={submitComment}
                disabled={!newComment.trim() || submitting}
                className="self-end w-9 h-9 flex items-center justify-center bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string | null }) {
  return (
    <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200">
      <div className="flex items-center gap-1.5 mb-1 text-neutral-400 text-xs">{icon}{label}</div>
      <p className="font-semibold text-neutral-900 text-sm">{value}</p>
      {sub && <p className="text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-neutral-400 text-xs mb-0.5">{icon}{label}</div>
      <p className="text-sm font-medium text-neutral-900">{value}</p>
    </div>
  );
}
