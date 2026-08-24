import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Microscope, Building2, Stethoscope, FlaskConical, Eye, EyeOff } from 'lucide-react';

type Mode = 'login' | 'register';
type Role = 'center' | 'doctor' | 'lab';

const roles = [
  { value: 'center' as Role, label: 'Dental Center', desc: 'A clinic or dental center placing orders', icon: Building2 },
  { value: 'doctor' as Role, label: 'Dentist / Doctor', desc: 'An individual dental practitioner', icon: Stethoscope },
  { value: 'lab' as Role, label: 'Dental Laboratory', desc: 'A lab receiving and fulfilling orders', icon: FlaskConical },
];

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<Role>('center');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            role,
            name,
            phone: phone || null,
            city: city || null,
          });
          if (profileError) throw profileError;
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-teal-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-teal-400 rounded-xl flex items-center justify-center">
            <Microscope className="w-6 h-6 text-primary-950" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-none">Bridge</h1>
            <p className="text-teal-300 text-xs">Lab Ordering Platform</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-modal overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-neutral-200">
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-4 text-sm font-semibold transition-colors ${
                  mode === m ? 'text-primary-600 border-b-2 border-primary-600' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-2 uppercase tracking-wide">Account Type</label>
                  <div className="grid grid-cols-1 gap-2">
                    {roles.map(r => {
                      const Icon = r.icon;
                      return (
                        <label
                          key={r.value}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            role === r.value ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="sr-only" />
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${role === r.value ? 'bg-primary-500' : 'bg-neutral-100'}`}>
                            <Icon className={`w-4 h-4 ${role === r.value ? 'text-white' : 'text-neutral-500'}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-neutral-800">{r.label}</p>
                            <p className="text-xs text-neutral-500">{r.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">
                    {role === 'lab' ? 'Lab Name' : role === 'center' ? 'Center Name' : 'Doctor Name'}
                  </label>
                  <input
                    type="text" required value={name} onChange={e => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">City</label>
                    <input
                      type="text" value={city} onChange={e => setCity(e.target.value)}
                      placeholder="City"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">Phone</label>
                    <input
                      type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="+1 234..."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">Email</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3.5 py-2.5">{error}</div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-teal-300/60 text-xs mt-6">&copy; 2025 Bridge. All rights reserved.</p>
      </div>
    </div>
  );
}
