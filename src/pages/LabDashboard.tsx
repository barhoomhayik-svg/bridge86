import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, Service, CasePhoto } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Image, Package, X, Clock, DollarSign, Camera, Upload, AlertCircle } from 'lucide-react';

export default function LabDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'services' | 'gallery'>('services');
  const [services, setServices] = useState<Service[]>([]);
  const [photos, setPhotos] = useState<CasePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showPhotoForm, setShowPhotoForm] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: sv }, { data: ph }] = await Promise.all([
      supabase.from('services').select('*').eq('lab_id', profile.id).order('created_at'),
      supabase.from('case_photos').select('*').eq('lab_id', profile.id).order('created_at', { ascending: false }),
    ]);
    setServices(sv ?? []);
    setPhotos(ph ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Lab Profile</h1>
        <p className="text-neutral-500 text-sm mt-1">Manage your services and case gallery</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{services.length}</p>
              <p className="text-sm text-neutral-500">Services</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
              <Image className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{photos.length}</p>
              <p className="text-sm text-neutral-500">Case Photos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl mb-5 w-fit">
        {(['services', 'gallery'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-white text-neutral-900 shadow-card' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            {t === 'services' ? 'Services' : 'Case Gallery'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1,2].map(i => <div key={i} className="bg-white rounded-xl h-24 animate-pulse shadow-card" />)}
        </div>
      ) : tab === 'services' ? (
        <ServicesTab services={services} onAdd={() => setShowServiceForm(true)} onDelete={fetchData} />
      ) : (
        <GalleryTab photos={photos} onAdd={() => setShowPhotoForm(true)} onDelete={fetchData} />
      )}

      {showServiceForm && <ServiceForm onClose={() => setShowServiceForm(false)} onSaved={() => { setShowServiceForm(false); fetchData(); }} />}
      {showPhotoForm && <PhotoForm onClose={() => setShowPhotoForm(false)} onSaved={() => { setShowPhotoForm(false); fetchData(); }} />}
    </div>
  );
}

function ServicesTab({ services, onAdd, onDelete }: { services: Service[]; onAdd: () => void; onDelete: () => void }) {
  const deleteService = async (id: string) => {
    await supabase.from('services').delete().eq('id', id);
    onDelete();
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500">{services.length} service{services.length !== 1 ? 's' : ''}</p>
        <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Add Service
        </button>
      </div>
      {services.length === 0 ? (
        <EmptyState icon={<Package className="w-10 h-10 text-neutral-300" />} title="No services yet" sub="Add your first service to attract orders" />
      ) : (
        <div className="space-y-2">
          {services.map(s => (
            <div key={s.id} className="bg-white rounded-xl p-4 shadow-card flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <p className="font-semibold text-neutral-900">{s.name}</p>
                {s.description && <p className="text-sm text-neutral-500 mt-0.5">{s.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500">
                  {(s.price_from || s.price_to) && (
                    <span className="flex items-center gap-1 text-primary-600">
                      <DollarSign className="w-3 h-3" />
                      {s.price_from && s.price_to ? `$${s.price_from}–$${s.price_to}` : s.price_from ? `from $${s.price_from}` : `up to $${s.price_to}`}
                    </span>
                  )}
                  {s.turnaround_days && (
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.turnaround_days} days</span>
                  )}
                </div>
              </div>
              <button onClick={() => deleteService(s.id)} className="text-neutral-300 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GalleryTab({ photos, onAdd, onDelete }: { photos: CasePhoto[]; onAdd: () => void; onDelete: () => void }) {
  const deletePhoto = async (id: string) => {
    await supabase.from('case_photos').delete().eq('id', id);
    onDelete();
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500">{photos.length} photo{photos.length !== 1 ? 's' : ''}</p>
        <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Add Photo
        </button>
      </div>
      {photos.length === 0 ? (
        <EmptyState icon={<Image className="w-10 h-10 text-neutral-300" />} title="No photos yet" sub="Showcase your best cases to attract clients" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map(p => (
            <div key={p.id} className="relative group rounded-xl overflow-hidden bg-neutral-100 aspect-square">
              <img src={p.photo_url} alt={p.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-end">
                <div className="p-2 w-full opacity-0 group-hover:opacity-100 transition-all">
                  <p className="text-white text-xs font-semibold truncate">{p.title}</p>
                </div>
              </div>
              <button onClick={() => deletePhoto(p.id)}
                className="absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [days, setDays] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true); setError('');
    const { error } = await supabase.from('services').insert({
      lab_id: profile.id, name, description: desc || null,
      price_from: priceFrom ? parseFloat(priceFrom) : null,
      price_to: priceTo ? parseFloat(priceTo) : null,
      turnaround_days: days ? parseInt(days) : null,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    onSaved();
  };

  return (
    <Modal title="Add Service" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Service Name *">
          <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Porcelain Crown" className={inputCls} />
        </Field>
        <Field label="Description">
          <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief description..." className={inputCls + ' resize-none'} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price From ($)">
            <input type="number" min="0" step="0.01" value={priceFrom} onChange={e => setPriceFrom(e.target.value)} placeholder="0.00" className={inputCls} />
          </Field>
          <Field label="Price To ($)">
            <input type="number" min="0" step="0.01" value={priceTo} onChange={e => setPriceTo(e.target.value)} placeholder="0.00" className={inputCls} />
          </Field>
          <Field label="Turnaround (days)">
            <input type="number" min="1" value={days} onChange={e => setDays(e.target.value)} placeholder="5" className={inputCls} />
          </Field>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <ModalButtons onClose={onClose} loading={loading} label="Add Service" />
      </form>
    </Modal>
  );
}

function PhotoForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    if (f.size > 10 * 1024 * 1024) { setError('Image must be under 10 MB.'); return; }
    setError('');
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !file) return;
    setUploading(true); setError('');

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${profile.id}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('case-photos')
      .upload(path, file, { upsert: false });

    if (uploadErr) { setError(uploadErr.message); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from('case-photos').getPublicUrl(path);

    const { error: dbErr } = await supabase.from('case_photos').insert({
      lab_id: profile.id, title, description: desc || null, photo_url: publicUrl,
    });

    setUploading(false);
    if (dbErr) { setError(dbErr.message); return; }
    onSaved();
  };

  return (
    <Modal title="Add Case Photo" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Title *">
          <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. All-ceramic veneer case" className={inputCls} />
        </Field>

        {/* Upload area */}
        {!preview ? (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center hover:border-primary-400 hover:bg-primary-50/30 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center">
                <Upload className="w-6 h-6 text-neutral-400" />
              </div>
            </div>
            <p className="text-sm font-medium text-neutral-700">Drag & drop or click to upload</p>
            <p className="text-xs text-neutral-400 mt-1">JPEG, PNG, WebP — max 10 MB</p>
            <div className="flex justify-center gap-2 mt-4">
              <button
                type="button"
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" /> Choose File
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" /> Take Photo
              </button>
            </div>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden border border-neutral-200">
            <img src={preview} alt="preview" className="w-full h-48 object-cover" />
            <button
              type="button"
              onClick={() => { setFile(null); setPreview(null); }}
              className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors shadow-sm"
            >
              <X className="w-3.5 h-3.5 text-neutral-600 hover:text-red-500" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 px-3 py-2">
              <p className="text-white text-xs truncate">{file?.name}</p>
            </div>
          </div>
        )}

        {/* Hidden inputs */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

        <Field label="Description">
          <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief case notes..." className={inputCls + ' resize-none'} />
        </Field>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        <ModalButtons onClose={onClose} loading={uploading} label={uploading ? 'Uploading...' : 'Add Photo'} disabled={!file} />
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-neutral-200">
          <h2 className="font-bold text-neutral-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
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

function ModalButtons({ onClose, loading, label, disabled }: { onClose: () => void; loading: boolean; label: string; disabled?: boolean }) {
  return (
    <div className="flex gap-3 pt-1">
      <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-neutral-300 text-neutral-700 font-semibold rounded-xl text-sm hover:bg-neutral-50 transition-colors">Cancel</button>
      <button type="submit" disabled={loading || disabled} className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-xl text-sm transition-colors">{loading ? 'Saving...' : label}</button>
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="text-center py-12">
      <div className="flex justify-center mb-3">{icon}</div>
      <p className="font-medium text-neutral-500">{title}</p>
      <p className="text-sm text-neutral-400 mt-1">{sub}</p>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';
