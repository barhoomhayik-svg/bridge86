import React, { useEffect, useState, useCallback } from 'react';
import { supabase, Profile, Service, CasePhoto } from '../lib/supabase';
import { MapPin, Star, Clock, ChevronRight, Search, Phone, Building2, Microscope, FlaskConical, Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LabWithDetails extends Profile {
  services: Service[];
  case_photos: CasePhoto[];
  serviceCount: number;
  photoCount: number;
}

interface Props {
  onSelectLab: (lab: Profile) => void;
  onRequestQuotation: (lab: Profile) => void;
}

export default function LabDiscovery({ onSelectLab, onRequestQuotation }: Props) {
  const { profile } = useAuth();
  const [labs, setLabs] = useState<LabWithDetails[]>([]);
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFavourites, setShowFavourites] = useState(false);
  const [selectedLab, setSelectedLab] = useState<LabWithDetails | null>(null);

  const fetchFavourites = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('favourite_labs')
      .select('lab_id')
      .eq('user_id', profile.id);
    setFavouriteIds(new Set((data ?? []).map(f => f.lab_id)));
  }, [profile]);

  const fetchLabs = useCallback(async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*').eq('role', 'lab');
    if (!profiles) { setLoading(false); return; }
    const labsWithDetails = await Promise.all(
      profiles.map(async (lab) => {
        const [{ data: services }, { data: photos }] = await Promise.all([
          supabase.from('services').select('*').eq('lab_id', lab.id),
          supabase.from('case_photos').select('*').eq('lab_id', lab.id).limit(6),
        ]);
        return { ...lab, services: services ?? [], case_photos: photos ?? [], serviceCount: services?.length ?? 0, photoCount: photos?.length ?? 0 };
      })
    );
    setLabs(labsWithDetails);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLabs(); fetchFavourites(); }, [fetchLabs, fetchFavourites]);

  const toggleFavourite = async (e: React.MouseEvent, labId: string) => {
    e.stopPropagation();
    if (!profile) return;
    if (favouriteIds.has(labId)) {
      await supabase.from('favourite_labs').delete().eq('user_id', profile.id).eq('lab_id', labId);
      setFavouriteIds(prev => { const s = new Set(prev); s.delete(labId); return s; });
    } else {
      await supabase.from('favourite_labs').insert({ user_id: profile.id, lab_id: labId });
      setFavouriteIds(prev => new Set([...prev, labId]));
    }
  };

  let filtered = labs.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    (l.city ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (showFavourites) filtered = filtered.filter(l => favouriteIds.has(l.id));

  // Show favourites first
  filtered = [...filtered].sort((a, b) => {
    const aFav = favouriteIds.has(a.id) ? 0 : 1;
    const bFav = favouriteIds.has(b.id) ? 0 : 1;
    return aFav - bFav;
  });

  if (selectedLab) {
    return (
      <LabDetail
        lab={selectedLab}
        isFavourite={favouriteIds.has(selectedLab.id)}
        onToggleFavourite={(e) => toggleFavourite(e, selectedLab.id)}
        onBack={() => setSelectedLab(null)}
        onOrder={() => onSelectLab(selectedLab)}
        onQuotation={() => onRequestQuotation(selectedLab)}
      />
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-neutral-900">Find Dental Labs</h1>
        <p className="text-neutral-500 text-sm mt-1">Discover labs near you and place orders</p>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text" placeholder="Search by lab name or city..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-card"
          />
        </div>
        <button
          onClick={() => setShowFavourites(!showFavourites)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
            showFavourites ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
          }`}
        >
          <Heart className={`w-4 h-4 ${showFavourites ? 'fill-red-500 text-red-500' : ''}`} />
          Favourites {favouriteIds.size > 0 && <span className="bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full">{favouriteIds.size}</span>}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl p-5 shadow-card animate-pulse h-36" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FlaskConical className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500 font-medium">{showFavourites ? 'No favourite labs yet' : 'No labs found'}</p>
          <p className="text-neutral-400 text-sm">{showFavourites ? 'Click the heart on any lab to save it' : 'Try adjusting your search'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(lab => {
            const isFav = favouriteIds.has(lab.id);
            return (
              <button
                key={lab.id}
                onClick={() => setSelectedLab(lab)}
                className="bg-white rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all text-left group border border-transparent hover:border-primary-100 relative"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    {lab.logo_url ? (
                      <img src={lab.logo_url} alt={lab.name} className="w-11 h-11 rounded-xl object-cover" />
                    ) : (
                      <div className="w-11 h-11 bg-primary-50 rounded-xl flex items-center justify-center">
                        <Microscope className="w-5 h-5 text-primary-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => toggleFavourite(e, lab.id)}
                      className={`p-1.5 rounded-lg transition-all ${isFav ? 'text-red-500' : 'text-neutral-300 hover:text-red-400'}`}
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500' : ''}`} />
                    </button>
                    <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-primary-500 transition-colors" />
                  </div>
                </div>
                <h3 className="font-semibold text-neutral-900 mb-1">{lab.name}</h3>
                {lab.city && (
                  <div className="flex items-center gap-1 text-neutral-500 text-xs mb-3">
                    <MapPin className="w-3 h-3" /> {lab.city}
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" />{lab.serviceCount} service{lab.serviceCount !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />{lab.photoCount} photo{lab.photoCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {lab.services.slice(0, 2).map(s => (
                  <span key={s.id} className="inline-block mt-2 mr-1.5 px-2 py-0.5 bg-teal-50 text-teal-700 text-xs rounded-full">{s.name}</span>
                ))}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LabDetail({ lab, isFavourite, onToggleFavourite, onBack, onOrder, onQuotation }: {
  lab: LabWithDetails; isFavourite: boolean;
  onToggleFavourite: (e: React.MouseEvent) => void;
  onBack: () => void; onOrder: () => void; onQuotation: () => void;
}) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 mb-5 transition-colors">
        <ChevronRight className="w-4 h-4 rotate-180" /> Back to labs
      </button>
      <div className="bg-white rounded-2xl shadow-card p-6 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {lab.logo_url ? (
              <img src={lab.logo_url} alt={lab.name} className="w-16 h-16 rounded-2xl object-cover" />
            ) : (
              <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center">
                <Microscope className="w-7 h-7 text-primary-600" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-neutral-900">{lab.name}</h2>
              {lab.city && <p className="text-sm text-neutral-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3.5 h-3.5" />{lab.city}</p>}
              {lab.address && <p className="text-xs text-neutral-400 mt-0.5">{lab.address}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onToggleFavourite}
              className={`p-2 rounded-xl border transition-all ${isFavourite ? 'bg-red-50 border-red-200 text-red-500' : 'bg-neutral-50 border-neutral-200 text-neutral-400 hover:text-red-400'}`}
            >
              <Heart className={`w-5 h-5 ${isFavourite ? 'fill-red-500' : ''}`} />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onQuotation}
                className="px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-sm font-semibold rounded-xl transition-colors"
              >
                Request Quotation
              </button>
              <button onClick={onOrder} className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors">
                Place Order
              </button>
            </div>
          </div>
        </div>
        {lab.phone && (
          <div className="flex items-center gap-2 mt-4 text-sm text-neutral-600">
            <Phone className="w-4 h-4 text-neutral-400" />{lab.phone}
          </div>
        )}
        {lab.latitude && lab.longitude && (
          <div className="mt-4 rounded-xl overflow-hidden border border-neutral-200 h-40">
            <iframe
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${lab.longitude-0.01},${lab.latitude-0.01},${lab.longitude+0.01},${lab.latitude+0.01}&layer=mapnik&marker=${lab.latitude},${lab.longitude}`}
              className="w-full h-full border-0"
              title="Lab location"
              loading="lazy"
            />
          </div>
        )}
      </div>

      {lab.services.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3">Services</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lab.services.map(s => (
              <div key={s.id} className="bg-white rounded-xl p-4 shadow-card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-neutral-900 text-sm">{s.name}</p>
                    {s.description && <p className="text-xs text-neutral-500 mt-0.5">{s.description}</p>}
                  </div>
                  {s.turnaround_days && (
                    <span className="flex items-center gap-1 text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full ml-2 whitespace-nowrap">
                      <Clock className="w-3 h-3" />{s.turnaround_days}d
                    </span>
                  )}
                </div>
                {(s.price_from || s.price_to) && (
                  <p className="text-xs font-semibold text-primary-600 mt-2">
                    {s.price_from && s.price_to ? `$${s.price_from} – $${s.price_to}` : s.price_from ? `From $${s.price_from}` : `Up to $${s.price_to}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {lab.case_photos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3">Case Gallery</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {lab.case_photos.map(photo => (
              <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-neutral-100">
                <img src={photo.photo_url} alt={photo.title} className="w-full h-full object-cover hover:scale-105 transition-transform" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
