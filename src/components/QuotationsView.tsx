import { useEffect, useState, useCallback } from 'react';
import { supabase, Quotation, QuotationService, QuotationStatus } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  MessageSquare, X, DollarSign, CheckCircle2, XCircle,
  Stethoscope, ChevronRight, AlertCircle, FileText, Hash, Package,
} from 'lucide-react';

const STATUS_CONFIG: Record<QuotationStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:   { label: 'Awaiting Quote',  color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  responded: { label: 'Quote Received',  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  accepted:  { label: 'Accepted',        color: 'text-teal-700',   bg: 'bg-teal-50',   border: 'border-teal-200' },
  declined:  { label: 'Declined',        color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
};

function totalQuoted(services: QuotationService[]): number | null {
  const priced = services.filter(s => s.quoted_price != null);
  if (!priced.length) return null;
  return priced.reduce((sum, s) => sum + (s.quoted_price ?? 0), 0);
}

interface Props { isLab?: boolean }

export default function QuotationsView({ isLab = false }: Props) {
  const { profile } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Quotation | null>(null);

  // Lab respond state — per-service prices + overall notes
  const [showRespond, setShowRespond] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [responseNotes, setResponseNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchQuotations = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    let q = supabase
      .from('quotations')
      .select(`
        *,
        from_profile:profiles!quotations_from_id_fkey(*),
        lab_profile:profiles!quotations_lab_id_fkey(*),
        quotation_services(*, service:services(*))
      `)
      .order('created_at', { ascending: false });
    if (isLab) q = q.eq('lab_id', profile.id);
    else       q = q.eq('from_id', profile.id);
    const { data } = await q;
    setQuotations((data ?? []) as Quotation[]);
    setLoading(false);
  }, [profile, isLab]);

  useEffect(() => { fetchQuotations(); }, [fetchQuotations]);

  const openDetail = (q: Quotation) => {
    setSelected(q);
    setShowRespond(false);
    setError('');
    // Pre-fill prices from existing service estimates
    const init: Record<string, string> = {};
    for (const s of q.quotation_services ?? []) {
      init[s.id] = s.quoted_price?.toString() ?? s.service?.price_from?.toString() ?? '';
    }
    setPrices(init);
    setResponseNotes(q.response_notes ?? '');
  };

  const handleSendQuote = async () => {
    if (!selected) return;
    const services = selected.quotation_services ?? [];
    // Validate at least one price filled
    const anyPriced = services.some(s => prices[s.id] && !isNaN(parseFloat(prices[s.id])));
    if (!anyPriced) { setError('Enter a price for at least one service.'); return; }
    setError('');
    setSaving(true);
    try {
      // Update per-service prices
      await Promise.all(
        services
          .filter(s => prices[s.id] && !isNaN(parseFloat(prices[s.id])))
          .map(s =>
            supabase.from('quotation_services')
              .update({ quoted_price: parseFloat(prices[s.id]) })
              .eq('id', s.id)
          )
      );
      // Update quotation status + overall notes
      const { error: err } = await supabase.from('quotations').update({
        status: 'responded',
        response_notes: responseNotes || null,
        updated_at: new Date().toISOString(),
      }).eq('id', selected.id);
      if (err) throw err;
      setSelected(null);
      fetchQuotations();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send quote');
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptDecline = async (status: 'accepted' | 'declined') => {
    if (!selected) return;
    setSaving(true);
    await supabase.from('quotations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', selected.id);
    setSaving(false);
    setSelected(null);
    fetchQuotations();
  };

  const counts = quotations.reduce((acc, q) => {
    acc[q.status] = (acc[q.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {isLab ? 'Quotation Requests' : 'My Quotations'}
          </h1>
          <p className="text-neutral-500 text-sm mt-1">{quotations.length} request{quotations.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.entries(counts) as [QuotationStatus, number][]).map(([s, c]) => {
            const cfg = STATUS_CONFIG[s];
            return (
              <span key={s} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                {c} {cfg.label}
              </span>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => (
          <div key={i} className="bg-white rounded-xl h-20 animate-pulse shadow-card" />
        ))}</div>
      ) : quotations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-card">
          <MessageSquare className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
          <p className="text-neutral-500 font-medium">No quotation requests yet</p>
          {!isLab && <p className="text-neutral-400 text-xs mt-1">Go to Find Labs to request a quotation</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {quotations.map(q => {
            const cfg = STATUS_CONFIG[q.status];
            const other = isLab ? q.from_profile : q.lab_profile;
            const svcLines = q.quotation_services ?? [];
            const total = totalQuoted(svcLines);
            return (
              <button
                key={q.id}
                onClick={() => openDetail(q)}
                className="w-full bg-white rounded-xl p-4 shadow-card hover:shadow-card-hover transition-all text-left flex items-center gap-4 group"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${cfg.bg} ${cfg.border}`}>
                  <MessageSquare className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-neutral-900 text-sm">{other?.name ?? '—'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" /> {svcLines.length} service{svcLines.length !== 1 ? 's' : ''}
                    </span>
                    {svcLines.slice(0,2).map(s => (
                      <span key={s.id} className="flex items-center gap-1 text-neutral-600 font-medium">
                        <Stethoscope className="w-3 h-3 text-neutral-400" /> {s.service_name}
                      </span>
                    ))}
                    {svcLines.length > 2 && <span className="text-neutral-400">+{svcLines.length - 2} more</span>}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  {total != null && (
                    <div className="flex items-center gap-0.5 justify-end text-sm font-bold text-teal-700 mb-0.5">
                      <DollarSign className="w-3.5 h-3.5" />{total.toFixed(2)}
                    </div>
                  )}
                  <p className="text-xs text-neutral-400">{new Date(q.created_at).toLocaleDateString()}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-primary-500 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* ── Detail modal ── */}
      {selected && (() => {
        const cfg = STATUS_CONFIG[selected.status];
        const svcLines = selected.quotation_services ?? [];
        const total = totalQuoted(svcLines);
        const allPriced = svcLines.length > 0 && svcLines.every(s => s.quoted_price != null);
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg my-4">

              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-neutral-200">
                <div>
                  <h2 className="font-bold text-neutral-900">Quotation Detail</h2>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
                {/* Parties */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'From', p: selected.from_profile },
                    { label: 'Lab',  p: selected.lab_profile },
                  ].map(({ label, p }) => (
                    <div key={label} className="bg-neutral-50 rounded-xl p-3 border border-neutral-200">
                      <p className="text-xs text-neutral-400 mb-0.5">{label}</p>
                      <p className="font-semibold text-neutral-900 text-sm">{p?.name ?? '—'}</p>
                      {p?.city && <p className="text-xs text-neutral-500 mt-0.5">{p.city}</p>}
                    </div>
                  ))}
                </div>

                {/* Services list */}
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" /> Services ({svcLines.length})
                  </p>
                  <div className="space-y-2">
                    {svcLines.map((s, idx) => (
                      <div key={s.id} className={`rounded-xl border p-3.5 ${
                        s.service_id ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                              s.service_id ? 'bg-blue-200 text-blue-800' : 'bg-amber-200 text-amber-800'
                            }`}>{idx + 1}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className={`font-semibold text-sm ${s.service_id ? 'text-blue-900' : 'text-amber-900'}`}>
                                  {s.service_name}
                                </p>
                                {!s.service_id && (
                                  <span className="text-[10px] font-bold text-amber-600 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                                    Custom
                                  </span>
                                )}
                              </div>
                              {s.service?.description && (
                                <p className="text-xs text-blue-700 mt-0.5">{s.service.description}</p>
                              )}
                              {s.teeth_numbers && (
                                <p className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
                                  <Hash className="w-3 h-3" /> {s.teeth_numbers}
                                </p>
                              )}
                              {s.notes && (
                                <p className="text-xs text-neutral-600 mt-1 italic">"{s.notes}"</p>
                              )}
                            </div>
                          </div>

                          {/* Price column */}
                          <div className="flex-shrink-0 text-right">
                            {/* Lab respond: input */}
                            {isLab && selected.status === 'pending' && showRespond ? (
                              <div className="relative w-28">
                                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
                                <input
                                  type="number" min="0" step="0.01"
                                  value={prices[s.id] ?? ''}
                                  onChange={e => setPrices(prev => ({ ...prev, [s.id]: e.target.value }))}
                                  placeholder="0.00"
                                  className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-neutral-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
                                />
                              </div>
                            ) : s.quoted_price != null ? (
                              <div>
                                <p className="text-sm font-bold text-teal-700 flex items-center gap-0.5 justify-end">
                                  <DollarSign className="w-3.5 h-3.5" />{s.quoted_price.toFixed(2)}
                                </p>
                                <p className="text-[10px] text-neutral-400">quoted</p>
                              </div>
                            ) : s.service?.price_from ? (
                              <div>
                                <p className="text-xs text-neutral-400 flex items-center gap-0.5 justify-end">
                                  <DollarSign className="w-3 h-3" />
                                  {s.service.price_from}{s.service.price_to ? `–${s.service.price_to}` : ''}
                                </p>
                                <p className="text-[10px] text-neutral-400">estimate</p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  {total != null && (
                    <div className={`mt-2 flex items-center justify-between rounded-xl px-4 py-3 border ${
                      selected.status === 'accepted' ? 'bg-teal-50 border-teal-200' : 'bg-neutral-100 border-neutral-200'
                    }`}>
                      <span className="text-sm font-semibold text-neutral-600">Total Quoted Price</span>
                      <span className="text-xl font-extrabold text-teal-700 flex items-center gap-0.5">
                        <DollarSign className="w-4 h-4" />{total.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Overall notes */}
                {selected.description && (
                  <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200">
                    <p className="text-xs text-neutral-400 mb-1 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Case Notes
                    </p>
                    <p className="text-sm text-neutral-800">{selected.description}</p>
                  </div>
                )}

                {/* Lab response notes */}
                {selected.response_notes && (
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                    <p className="text-xs text-blue-500 mb-1 font-semibold uppercase tracking-wide flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Lab Notes
                    </p>
                    <p className="text-sm text-blue-800">{selected.response_notes}</p>
                  </div>
                )}

                {/* Accept/Decline result */}
                {selected.status === 'accepted' && (
                  <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-teal-700 text-sm font-semibold">
                    <CheckCircle2 className="w-4 h-4" /> You accepted this quotation
                  </div>
                )}
                {selected.status === 'declined' && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-semibold">
                    <XCircle className="w-4 h-4" /> You declined this quotation
                  </div>
                )}

                {/* ── LAB: respond button / form ── */}
                {isLab && selected.status === 'pending' && !showRespond && (
                  <button
                    onClick={() => setShowRespond(true)}
                    className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-sm transition-colors"
                  >
                    Send Quote to Client
                  </button>
                )}

                {isLab && selected.status === 'pending' && showRespond && (
                  <div className="space-y-3 bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-teal-600" /> Enter price per service above, then add notes
                    </p>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">
                        Overall Notes / Timeline (optional)
                      </label>
                      <textarea
                        rows={2}
                        value={responseNotes}
                        onChange={e => setResponseNotes(e.target.value)}
                        placeholder="Delivery timeline, materials, conditions…"
                        className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      />
                    </div>

                    {!allPriced && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        You can leave some prices blank — client will see which services were priced.
                      </p>
                    )}

                    {error && (
                      <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => setShowRespond(false)}
                        className="flex-1 py-2.5 border border-neutral-300 text-neutral-700 font-semibold rounded-xl text-sm hover:bg-neutral-50"
                      >
                        Cancel
                      </button>
                      <button type="button" onClick={handleSendQuote} disabled={saving}
                        className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold rounded-xl text-sm"
                      >
                        {saving ? 'Sending…' : `Send Quote${total != null ? ` · $${total.toFixed(2)}` : ''}`}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── CLIENT: Accept / Decline ── */}
                {!isLab && selected.status === 'responded' && (
                  <div className="space-y-3">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 text-center">
                      {total != null
                        ? <>Do you accept this quote for <strong>${total.toFixed(2)}</strong>?</>
                        : 'Do you accept this quotation?'
                      }
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => handleAcceptDecline('declined')} disabled={saving}
                        className="flex-1 py-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 font-semibold rounded-xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <XCircle className="w-4 h-4" /> Decline
                      </button>
                      <button onClick={() => handleAcceptDecline('accepted')} disabled={saving}
                        className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Accept Quote
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-neutral-400 text-right pt-1">
                  Requested {new Date(selected.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
