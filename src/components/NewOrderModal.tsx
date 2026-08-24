import React, { useState, useEffect } from 'react';
import { supabase, Profile, Service } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Upload, AlertCircle } from 'lucide-react';

const SHADE_OPTIONS = ['A1','A2','A3','A3.5','A4','B1','B2','B3','B4','C1','C2','C3','C4','D2','D3','D4','BL1','BL2','BL3','BL4'];

interface Props {
  lab: Profile;
  services: Service[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewOrderModal({ lab, services, onClose, onSuccess }: Props) {
  const { profile } = useAuth();
  const [fileNumber, setFileNumber] = useState('');
  const [patientName, setPatientName] = useState('');
  const [drName, setDrName] = useState(profile?.role === 'doctor' ? (profile.name ?? '') : '');
  const [shade, setShade] = useState('');
  const [teethNumbers, setTeethNumbers] = useState<number[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [teamDoctors, setTeamDoctors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile?.role !== 'center') return;
    supabase
      .from('center_members')
      .select('doctor_profile:profiles!center_members_doctor_id_fkey(*)')
      .eq('center_id', profile.id)
      .then(({ data }) => {
        const docs = (data ?? []).map((m: { doctor_profile: Profile | Profile[] }) => Array.isArray(m.doctor_profile) ? m.doctor_profile[0] : m.doctor_profile).filter(Boolean) as Profile[];
        setTeamDoctors(docs);
      });
  }, [profile]);

  const toggleTooth = (n: number) => {
    setTeethNumbers(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort((a, b) => a - b));
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError(''); setLoading(true);
    try {
      const { data: order, error: orderError } = await supabase.from('orders').insert({
        from_id: profile.id,
        lab_id: lab.id,
        doctor_id: selectedDoctorId || null,
        file_number: fileNumber,
        patient_name: patientName,
        dr_name: drName,
        shade: shade || null,
        teeth_numbers: teethNumbers.length ? teethNumbers.join(', ') : null,
        service_id: serviceId || null,
        notes: notes || null,
        due_date: dueDate || null,
      }).select().single();
      if (orderError) throw orderError;

      if (attachments.length > 0 && order) {
        for (const file of attachments) {
          const ext = file.name.split('.').pop();
          const path = `orders/${order.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { data: uploaded, error: uploadError } = await supabase.storage
            .from('order-attachments').upload(path, file);
          if (!uploadError && uploaded) {
            const { data: { publicUrl } } = supabase.storage.from('order-attachments').getPublicUrl(path);
            await supabase.from('order_attachments').insert({
              order_id: order.id, file_name: file.name,
              file_url: publicUrl, file_size: file.size, mime_type: file.type,
            });
          }
        }
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const upperTeeth = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  const lowerTeeth = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-neutral-200">
          <div>
            <h2 className="font-bold text-neutral-900">New Order</h2>
            <p className="text-sm text-neutral-500">To: {lab.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="File Number *">
              <input type="text" required value={fileNumber} onChange={e => setFileNumber(e.target.value)}
                placeholder="Patient file #" className={inputCls} />
            </Field>
            <Field label="Dr. Name *">
              {teamDoctors.length > 0 ? (
                <div className="space-y-1.5">
                  <select
                    value={drName}
                    onChange={e => {
                      const val = e.target.value;
                      setDrName(val);
                      const doc = teamDoctors.find(d => d.name === val);
                      setSelectedDoctorId(doc?.id ?? '');
                    }}
                    className={inputCls + ' bg-white'}
                  >
                    <option value="">Select doctor...</option>
                    {teamDoctors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    <option value="__custom">Other (type name)</option>
                  </select>
                  {drName === '__custom' && (
                    <input type="text" placeholder="Enter doctor name"
                      onChange={e => { setDrName(e.target.value); setSelectedDoctorId(''); }}
                      className={inputCls} />
                  )}
                </div>
              ) : (
                <input type="text" required value={drName} onChange={e => setDrName(e.target.value)}
                  placeholder="Treating doctor" className={inputCls} />
              )}
            </Field>
          </div>

          <Field label="Patient Name *">
            <input type="text" required value={patientName} onChange={e => setPatientName(e.target.value)}
              placeholder="Full patient name" className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Shade">
              <select value={shade} onChange={e => setShade(e.target.value)} className={inputCls + ' bg-white'}>
                <option value="">Select shade</option>
                {SHADE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Service">
              <select value={serviceId} onChange={e => setServiceId(e.target.value)} className={inputCls + ' bg-white'}>
                <option value="">Select service</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>

          {/* Tooth chart */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-2 uppercase tracking-wide">
              Teeth Numbers {teethNumbers.length > 0 && <span className="text-primary-600 normal-case font-normal">({teethNumbers.join(', ')})</span>}
            </label>
            <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200">
              <div className="flex justify-center gap-0.5 mb-1">
                {upperTeeth.map(n => (
                  <button type="button" key={n} onClick={() => toggleTooth(n)}
                    className={`w-7 h-7 text-[10px] font-medium rounded transition-all ${teethNumbers.includes(n) ? 'bg-primary-500 text-white' : 'bg-white text-neutral-600 border border-neutral-200 hover:border-primary-300'}`}
                  >{n}</button>
                ))}
              </div>
              <div className="border-t border-dashed border-neutral-300 my-1.5" />
              <div className="flex justify-center gap-0.5">
                {lowerTeeth.map(n => (
                  <button type="button" key={n} onClick={() => toggleTooth(n)}
                    className={`w-7 h-7 text-[10px] font-medium rounded transition-all ${teethNumbers.includes(n) ? 'bg-primary-500 text-white' : 'bg-white text-neutral-600 border border-neutral-200 hover:border-primary-300'}`}
                  >{n}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Field label="Due Date">
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Notes">
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any special instructions..." className={inputCls + ' resize-none'} />
          </Field>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">Attachments</label>
            <label className="flex items-center gap-2 px-4 py-3 bg-neutral-50 border-2 border-dashed border-neutral-300 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-all">
              <Upload className="w-4 h-4 text-neutral-400" />
              <span className="text-sm text-neutral-500">Click to upload files (X-rays, scans...)</span>
              <input type="file" multiple className="sr-only" onChange={handleFiles} accept="image/*,.pdf,.dcm" />
            </label>
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {attachments.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-lg text-sm">
                    <span className="text-neutral-700 truncate">{f.name}</span>
                    <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-neutral-400 hover:text-red-500 ml-2">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3.5 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
        </form>

        <div className="p-5 border-t border-neutral-200 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-neutral-300 text-neutral-700 font-semibold rounded-xl text-sm hover:bg-neutral-50 transition-colors">
            Cancel
          </button>
          <button
            type="submit" disabled={loading}
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            {loading ? 'Submitting...' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';
