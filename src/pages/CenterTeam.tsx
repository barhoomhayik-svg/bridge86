import { useEffect, useState, useCallback } from 'react';
import { supabase, Profile, CenterMember } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Users, UserPlus, Trash2, Search, Stethoscope,
  Loader2, AlertCircle, Building2, LogOut as Leave, MapPin, Phone,
} from 'lucide-react';

export default function CenterTeam() {
  const { profile } = useAuth();
  if (!profile) return null;
  return profile.role === 'center' ? <CenterView /> : <DoctorView />;
}

/* ─── Center view: manage doctors ─────────────────────────────────────────── */

function CenterView() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<CenterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchMembers = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('center_members')
      .select('*, doctor_profile:profiles!center_members_doctor_id_fkey(*)')
      .eq('center_id', profile.id)
      .order('created_at');
    setMembers(data ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const searchDoctors = useCallback(async () => {
    if (search.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const q = search.trim().toUpperCase();
    // Exact match on profile_code first, then name search
    const isCodeSearch = /^[A-Z0-9]{2,6}$/.test(q);
    let data: typeof results = [];
    if (isCodeSearch) {
      const { data: exact } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'doctor')
        .eq('profile_code', q)
        .limit(1);
      data = exact ?? [];
    }
    // Also search by name (always)
    const { data: byName } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'doctor')
      .ilike('name', `%${search.trim()}%`)
      .limit(10);
    const merged = [...data, ...(byName ?? []).filter(d => !data.find(e => e.id === d.id))];
    const memberIds = members.map(m => m.doctor_id);
    setResults(merged.filter(d => !memberIds.includes(d.id) && d.id !== profile?.id));
    setSearching(false);
  }, [search, members, profile]);

  useEffect(() => {
    const t = setTimeout(searchDoctors, 300);
    return () => clearTimeout(t);
  }, [searchDoctors]);

  const addMember = async (doctor: Profile) => {
    if (!profile) return;
    setAddingId(doctor.id);
    setError('');
    const { error } = await supabase.from('center_members').insert({
      center_id: profile.id,
      doctor_id: doctor.id,
    });
    setAddingId(null);
    if (error) { setError(error.message); return; }
    setSearch('');
    setResults([]);
    fetchMembers();
  };

  const removeMember = async (memberId: string) => {
    await supabase.from('center_members').delete().eq('id', memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
          <Users className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Team</h1>
          <p className="text-sm text-neutral-500">
            {members.length} doctor{members.length !== 1 ? 's' : ''} linked to your center
          </p>
        </div>
      </div>

      {/* Add doctor search */}
      <div className="bg-white rounded-2xl shadow-card p-5 mb-5">
        <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary-600" /> Add Doctor
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text" placeholder="Search by name or paste Account ID (e.g. A1B2C3)..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 animate-spin" />
          )}
        </div>

        {results.length > 0 && (
          <div className="mt-2 border border-neutral-200 rounded-xl overflow-hidden divide-y divide-neutral-100">
            {results.map(doc => (
              <div key={doc.id} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50">
                <div className="flex items-center gap-3">
                  {doc.logo_url ? (
                    <img src={doc.logo_url} alt={doc.name} className="w-9 h-9 rounded-xl object-cover" />
                  ) : (
                    <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                      <Stethoscope className="w-4 h-4 text-blue-600" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {doc.city && <p className="text-xs text-neutral-500">{doc.city}</p>}
                      {doc.profile_code && (
                        <span className="font-mono text-xs font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                          {doc.profile_code}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => addMember(doc)}
                  disabled={addingId === doc.id}
                  className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {addingId === doc.id ? '...' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        )}

        {search.length >= 2 && !searching && results.length === 0 && (
          <p className="text-sm text-neutral-400 mt-2 text-center py-2">
            No doctors found matching "{search}"
          </p>
        )}

        {error && (
          <div className="flex items-center gap-2 mt-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* Member list */}
      <div>
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
          Current Team ({members.length})
        </h3>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-xl h-16 animate-pulse shadow-card" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-card border border-neutral-100">
            <Users className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
            <p className="text-neutral-500 font-medium text-sm">No team members yet</p>
            <p className="text-neutral-400 text-xs mt-1">
              Search above to add doctors who work with your center
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map(m => {
              const doc = m.doctor_profile;
              return (
                <div key={m.id} className="bg-white rounded-xl p-4 shadow-card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {doc?.logo_url ? (
                      <img src={doc.logo_url} alt={doc?.name} className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                        <Stethoscope className="w-5 h-5 text-blue-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-neutral-900 text-sm">{doc?.name ?? '—'}</p>
                      <div className="flex items-center gap-3 text-xs text-neutral-500 mt-0.5">
                        {doc?.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {doc.city}
                          </span>
                        )}
                        {doc?.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {doc.phone}
                          </span>
                        )}
                        {doc?.profile_code && (
                          <span className="font-mono font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded text-[10px]">
                            {doc.profile_code}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeMember(m.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Doctor view: see and leave centers ──────────────────────────────────── */

interface CenterMembership {
  id: string;
  center_id: string;
  center_profile: Profile;
  created_at: string;
}

function DoctorView() {
  const { profile } = useAuth();
  const [memberships, setMemberships] = useState<CenterMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const fetchMemberships = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('center_members')
      .select('*, center_profile:profiles!center_members_center_id_fkey(*)')
      .eq('doctor_id', profile.id)
      .order('created_at');
    setMemberships((data ?? []) as CenterMembership[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchMemberships(); }, [fetchMemberships]);

  const leaveMembership = async (membershipId: string) => {
    setLeavingId(membershipId);
    await supabase.from('center_members').delete().eq('id', membershipId);
    setMemberships(prev => prev.filter(m => m.id !== membershipId));
    setLeavingId(null);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">My Centers</h1>
          <p className="text-sm text-neutral-500">
            Centers you are linked to as a team doctor
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-5 flex items-start gap-3">
        <Users className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-primary-800">
          <p className="font-semibold mb-0.5">How team linking works</p>
          <p className="text-primary-700 text-xs leading-relaxed">
            Dental centers can add you as a team doctor. Share your <strong>Account ID</strong> (found in Settings) with a center so they can find and add you instantly. You can leave any center at any time below.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-xl h-20 animate-pulse shadow-card" />
          ))}
        </div>
      ) : memberships.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl shadow-card border border-neutral-100">
          <Building2 className="w-11 h-11 text-neutral-200 mx-auto mb-3" />
          <p className="text-neutral-500 font-medium">Not linked to any center yet</p>
          <p className="text-neutral-400 text-xs mt-1.5 max-w-xs mx-auto">
            When a dental center adds you to their team, they will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {memberships.map(m => {
            const center = m.center_profile;
            return (
              <div
                key={m.id}
                className="bg-white rounded-xl p-4 shadow-card flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {center?.logo_url ? (
                    <img src={center.logo_url} alt={center.name} className="w-11 h-11 rounded-xl object-cover" />
                  ) : (
                    <div className="w-11 h-11 bg-primary-50 rounded-xl flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-neutral-900 text-sm">{center?.name ?? '—'}</p>
                    <div className="flex items-center gap-3 text-xs text-neutral-500 mt-0.5">
                      {center?.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {center.city}
                        </span>
                      )}
                      {center?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {center.phone}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Joined {new Date(m.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => leaveMembership(m.id)}
                  disabled={leavingId === m.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg transition-all disabled:opacity-50"
                >
                  <Leave className="w-3.5 h-3.5" />
                  {leavingId === m.id ? 'Leaving...' : 'Leave'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
