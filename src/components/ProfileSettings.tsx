import React, { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Upload, MapPin, Phone, Building2, Save, Navigation, Loader2, Copy, Check } from 'lucide-react';

interface Props {
  onClose: () => void;
}

interface GeoResult {
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    road?: string;
    house_number?: string;
    country?: string;
  };
}

export default function ProfileSettings({ onClose }: Props) {
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [lat, setLat] = useState<string>(profile?.latitude?.toString() ?? '');
  const [lng, setLng] = useState<string>(profile?.longitude?.toString() ?? '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>(profile?.logo_url ?? '');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (!profile?.profile_code) return;
    navigator.clipboard.writeText(profile.profile_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const detectLocation = useCallback(async () => {
    setLocating(true);
    setError('');
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      const { latitude, longitude } = pos.coords;
      setLat(latitude.toFixed(6));
      setLng(longitude.toFixed(6));

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'Bridge/1.0' } }
      );
      if (res.ok) {
        const data: GeoResult = await res.json();
        const a = data.address ?? {};
        const detectedCity = a.city ?? a.town ?? a.village ?? '';
        const street = [a.house_number, a.road].filter(Boolean).join(' ');
        if (detectedCity) setCity(detectedCity);
        if (street) setAddress(street);
      }
    } catch {
      setError('Could not detect location. Please allow location access.');
    } finally {
      setLocating(false);
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError('');
    try {
      let logoUrl = profile.logo_url;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `logos/${profile.id}.${ext}`;
        const { error: upErr } = await supabase.storage.from('avatars').upload(path, logoFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
        logoUrl = publicUrl;
      }
      const { error: updateErr } = await supabase.from('profiles').update({
        name,
        phone: phone || null,
        address: address || null,
        city: city || null,
        latitude: lat ? parseFloat(lat) : null,
        longitude: lng ? parseFloat(lng) : null,
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);
      if (updateErr) throw updateErr;
      await refreshProfile();
      setSuccess(true);
      setTimeout(onClose, 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const mapUrl = lat && lng
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng)-0.01},${parseFloat(lat)-0.01},${parseFloat(lng)+0.01},${parseFloat(lat)+0.01}&layer=mapnik&marker=${lat},${lng}`
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-neutral-200">
          <h2 className="font-bold text-neutral-900">Profile Settings</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Profile Code */}
          {profile?.profile_code && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
              <label className="block text-xs font-semibold text-neutral-600 mb-2 uppercase tracking-wide">Your Account ID</label>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-3 bg-white border border-neutral-300 rounded-lg px-3 py-2.5">
                  <span className="font-mono text-lg font-bold tracking-widest text-primary-700 select-all">
                    {profile.profile_code}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copyCode}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-lg border transition-all flex-shrink-0 ${
                    copied
                      ? 'bg-teal-50 border-teal-200 text-teal-700'
                      : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-400'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-neutral-400 mt-2">Share this ID so centers or teams can find and add you</p>
            </div>
          )}

          {/* Logo upload */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-2 uppercase tracking-wide">Logo / Photo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-neutral-100 border-2 border-dashed border-neutral-300 overflow-hidden flex items-center justify-center flex-shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-8 h-8 text-neutral-300" />
                )}
              </div>
              <div>
                <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 text-sm font-semibold rounded-xl transition-colors border border-primary-200">
                  <Upload className="w-4 h-4" /> Upload Logo
                  <input type="file" accept="image/*" className="sr-only" onChange={handleLogoChange} />
                </label>
                <p className="text-xs text-neutral-400 mt-1.5">PNG, JPG up to 5MB</p>
              </div>
            </div>
          </div>

          {/* Basic info */}
          <div className="grid grid-cols-1 gap-3">
            <Field label="Display Name *">
              <input type="text" required value={name} onChange={e => setName(e.target.value)}
                className={inputCls} placeholder="Your name" />
            </Field>
            <Field label="Phone">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className={inputCls + ' pl-9'} placeholder="+1 234 567 8900" />
              </div>
            </Field>
          </div>

          {/* Address & Location */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Location</label>
              <button type="button" onClick={detectLocation} disabled={locating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition-colors disabled:opacity-60"
              >
                {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                {locating ? 'Detecting...' : 'Use My Location'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="City">
                <input type="text" value={city} onChange={e => setCity(e.target.value)}
                  className={inputCls} placeholder="City" />
              </Field>
              <Field label="Address">
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  className={inputCls} placeholder="Street address" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude">
                <input type="number" step="0.000001" value={lat} onChange={e => setLat(e.target.value)}
                  className={inputCls} placeholder="0.000000" />
              </Field>
              <Field label="Longitude">
                <input type="number" step="0.000001" value={lng} onChange={e => setLng(e.target.value)}
                  className={inputCls} placeholder="0.000000" />
              </Field>
            </div>
            {mapUrl && (
              <div className="mt-3 rounded-xl overflow-hidden border border-neutral-200 h-40">
                <iframe
                  src={mapUrl}
                  className="w-full h-full border-0"
                  title="Location map"
                  loading="lazy"
                />
              </div>
            )}
            {!mapUrl && (
              <div className="mt-3 h-32 rounded-xl bg-neutral-50 border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center text-neutral-400">
                <MapPin className="w-6 h-6 mb-1" />
                <p className="text-xs">Use "My Location" or enter coordinates to see map</p>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</p>}
          {success && <p className="text-sm text-teal-700 bg-teal-50 px-3 py-2 rounded-lg border border-teal-200">Saved successfully!</p>}
        </form>

        <div className="p-5 border-t border-neutral-200 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-neutral-300 text-neutral-700 font-semibold rounded-xl text-sm hover:bg-neutral-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
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
