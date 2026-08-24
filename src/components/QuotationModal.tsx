import React, { useState, useEffect } from 'react';
import { supabase, Profile, Service } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X, AlertCircle, Stethoscope, Clock, DollarSign, Plus, Trash2,
  ChevronDown, CheckSquare, Hash, FileText,
} from 'lucide-react';

interface Props {
  lab: Profile;
  onClose: () => void;
  onSuccess: () => void;
}

interface ServiceLine {
  key: string;
  service: Service | null;   // null = custom / special case
  customName: string;        // used when service===null
  notes: string;
  teethSet: Set<number>;
  showTeeth: boolean;
}

const UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

function ToothChart({
  selected, onToggle,
}: { selected: Set<number>; onToggle: (n: number) => void }) {
  const Cell = ({ n }: { n: number }) => (
    <button
      type="button"
      onClick={() => onToggle(n)}
      className={`w-7 h-8 rounded-sm text-[9px] font-semibold border transition-all flex-shrink-0 ${
        selected.has(n)
          ? 'bg-primary-600 border-primary-700 text-white'
          : 'bg-white border-neutral-300 text-neutral-500 hover:border-primary-400 hover:bg-primary-50'
      }`}
    >{n}</button>
  );
  return (
    <div className="bg-neutral-50 rounded-lg p-2.5 border border-neutral-200 mt-2">
      <div className="flex gap-0.5 justify-center mb-1 flex-wrap">
        {UPPER.map(n => <Cell key={n} n={n} />)}
      </div>
      <div className="border-t border-dashed border-neutral-300 my-1" />
      <div className="flex gap-0.5 justify-center flex-wrap">
        {LOWER.map(n => <Cell key={n} n={n} />)}
      </div>
      {selected.size > 0 && (
        <p className="text-xs text-primary-600 font-medium text-center mt-1.5">
          {Array.from(selected).sort((a,b)=>a-b).join(', ')}
        </p>
      )}
    </div>
  );
}

function newLine(): ServiceLine {
  return { key: crypto.randomUUID(), service: null, customName: '', notes: '', teethSet: new Set(), showTeeth: false };
}

function ServiceSelector({
  services, line, onChange,
}: {
  services: Service[];
  line: ServiceLine;
  onChange: (patch: Partial<ServiceLine>) => void;
}) {
  const [open, setOpen] = useState(false);
  const isCustom = line.service === null;
  const displayName = isCustom ? (line.customName || 'Special / Custom case…') : line.service!.name;

  return (
    <div className="border border-neutral-200 rounded-xl overflow-visible bg-white">
      {/* Service picker row */}
      <div className="flex items-center gap-2 p-3 border-b border-neutral-100">
        <Stethoscope className="w-4 h-4 text-neutral-400 flex-shrink-0" />
        <div className="flex-1 relative">
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className={`w-full flex items-center justify-between text-sm font-medium transition-colors ${
              line.service ? 'text-neutral-900' : 'text-neutral-400'
            }`}
          >
            <span className="truncate">{displayName}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ml-1 ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute z-30 top-full left-0 mt-1 w-72 bg-white rounded-xl border border-neutral-200 shadow-modal overflow-auto max-h-60">
              {/* Lab services */}
              {services.map(svc => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => { onChange({ service: svc, customName: '' }); setOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 hover:bg-primary-50 text-sm border-b border-neutral-100 last:border-0 ${
                    line.service?.id === svc.id ? 'bg-primary-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-neutral-900">{svc.name}</p>
                      {svc.description && <p className="text-xs text-neutral-500 mt-0.5">{svc.description}</p>}
                    </div>
                    {(svc.price_from || svc.price_to) && (
                      <span className="text-xs font-semibold text-teal-700 flex-shrink-0 flex items-center gap-0.5">
                        <DollarSign className="w-3 h-3" />
                        {svc.price_from && svc.price_to ? `${svc.price_from}–${svc.price_to}` : svc.price_from ?? svc.price_to}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {/* Special case option */}
              <button
                type="button"
                onClick={() => { onChange({ service: null }); setOpen(false); }}
                className="w-full text-left px-3 py-2.5 hover:bg-amber-50 text-sm text-amber-700 font-medium border-t border-neutral-100 flex items-center gap-2"
              >
                <FileText className="w-3.5 h-3.5" /> Special / Custom case
              </button>
            </div>
          )}
        </div>

        {/* Teeth toggle */}
        <button
          type="button"
          onClick={() => onChange({ showTeeth: !line.showTeeth })}
          className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border transition-colors ${
            line.teethSet.size > 0 || line.showTeeth
              ? 'bg-primary-50 border-primary-300 text-primary-700'
              : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:border-primary-300'
          }`}
          title="Select teeth"
        >
          <Hash className="w-3 h-3" />
          {line.teethSet.size > 0 ? line.teethSet.size : 'Teeth'}
        </button>
      </div>

      {/* Custom name field */}
      {isCustom && (
        <div className="px-3 pt-2.5 pb-0">
          <input
            type="text"
            value={line.customName}
            onChange={e => onChange({ customName: e.target.value })}
            placeholder="Describe the service or case…"
            className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-900 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      )}

      {/* Service hint */}
      {line.service && (line.service.price_from || line.service.turnaround_days) && (
        <div className="px-3 pt-2 pb-0 flex items-center gap-3 text-xs text-neutral-500">
          {(line.service.price_from || line.service.price_to) && (
            <span className="flex items-center gap-0.5 text-teal-700 font-medium">
              <DollarSign className="w-3 h-3" />
              {line.service.price_from && line.service.price_to
                ? `${line.service.price_from}–${line.service.price_to}`
                : line.service.price_from ?? line.service.price_to}
              <span className="text-neutral-400 font-normal ml-0.5">est.</span>
            </span>
          )}
          {line.service.turnaround_days && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-3 h-3" /> {line.service.turnaround_days} days
            </span>
          )}
        </div>
      )}

      {/* Teeth chart */}
      {line.showTeeth && (
        <div className="px-3 pt-2 pb-0">
          <ToothChart
            selected={line.teethSet}
            onToggle={n => {
              const next = new Set(line.teethSet);
              next.has(n) ? next.delete(n) : next.add(n);
              onChange({ teethSet: next });
            }}
          />
        </div>
      )}

      {/* Notes */}
      <div className="px-3 py-2.5">
        <textarea
          rows={2}
          value={line.notes}
          onChange={e => onChange({ notes: e.target.value })}
          placeholder="Notes for this service (shade, material, instructions)…"
          className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary-400 resize-none bg-neutral-50"
        />
      </div>
    </div>
  );
}

export default function QuotationModal({ lab, onClose, onSuccess }: Props) {
  const { profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [lines, setLines] = useState<ServiceLine[]>([newLine()]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('services').select('*').eq('lab_id', lab.id).order('name')
      .then(({ data }) => { setServices(data ?? []); setServicesLoading(false); });
  }, [lab.id]);

  const updateLine = (key: string, patch: Partial<ServiceLine>) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));

  const removeLine = (key: string) =>
    setLines(prev => prev.filter(l => l.key !== key));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const validLines = lines.filter(l => l.service !== null || l.customName.trim());
    if (validLines.length === 0) {
      setError('Add at least one service or describe the case.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // 1. Insert quotation
      const { data: quot, error: qErr } = await supabase.from('quotations').insert({
        from_id: profile.id,
        lab_id: lab.id,
        description: description || null,
      }).select('id').single();
      if (qErr || !quot) throw qErr ?? new Error('Failed to create quotation');

      // 2. Insert all service lines
      const rows = validLines.map(l => ({
        quotation_id: quot.id,
        service_id: l.service?.id ?? null,
        service_name: l.service?.name ?? l.customName.trim(),
        notes: l.notes || null,
        teeth_numbers: l.teethSet.size > 0
          ? Array.from(l.teethSet).sort((a,b)=>a-b).join(', ')
          : null,
      }));
      const { error: sErr } = await supabase.from('quotation_services').insert(rows);
      if (sErr) throw sErr;

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-200">
          <div>
            <h2 className="font-bold text-neutral-900">Request Quotation</h2>
            <p className="text-sm text-neutral-500 mt-0.5">
              Lab: <span className="font-medium text-neutral-700">{lab.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {servicesLoading ? (
            <div className="h-16 bg-neutral-100 rounded-xl animate-pulse" />
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                    Services <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-neutral-400">
                    Select lab services or describe custom cases
                  </span>
                </div>

                {services.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    No services listed — use Special / Custom case for each item.
                  </div>
                )}

                <div className="space-y-2.5">
                  {lines.map((line, idx) => (
                    <div key={line.key} className="relative">
                      {/* Index label + remove */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          Item {idx + 1}
                        </span>
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(line.key)}
                            className="text-red-400 hover:text-red-600 ml-auto"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <ServiceSelector
                        services={services}
                        line={line}
                        onChange={patch => updateLine(line.key, patch)}
                      />
                    </div>
                  ))}
                </div>

                {/* Add another service */}
                <button
                  type="button"
                  onClick={() => setLines(prev => [...prev, newLine()])}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-neutral-300 text-sm text-neutral-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add another service
                </button>
              </div>

              {/* Summary of selections */}
              {lines.some(l => l.service || l.customName) && (
                <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200">
                  <p className="text-xs font-semibold text-neutral-500 mb-2 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5" /> Selected ({lines.filter(l=>l.service||l.customName).length})
                  </p>
                  <div className="space-y-1">
                    {lines.filter(l => l.service || l.customName).map((l, i) => (
                      <div key={l.key} className="flex items-center gap-2 text-xs">
                        <span className="w-4 h-4 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold flex-shrink-0">{i+1}</span>
                        <span className="font-medium text-neutral-800">
                          {l.service?.name ?? l.customName}
                        </span>
                        {l.teethSet.size > 0 && (
                          <span className="text-neutral-400 flex items-center gap-0.5">
                            <Hash className="w-3 h-3" />{Array.from(l.teethSet).sort((a,b)=>a-b).join(', ')}
                          </span>
                        )}
                        {!l.service && (
                          <span className="text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-semibold">Custom</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Overall case notes */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">
              Overall Case Notes
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="General notes about the case, patient, or special requirements…"
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3.5 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-neutral-300 text-neutral-700 font-semibold rounded-xl text-sm hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
            <button type="submit" disabled={loading || servicesLoading}
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              {loading ? 'Sending…' : `Send Request (${lines.filter(l=>l.service||l.customName).length} service${lines.filter(l=>l.service||l.customName).length !== 1 ? 's' : ''})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
