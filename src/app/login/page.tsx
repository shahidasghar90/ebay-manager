'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Keep "Signing in..." visible until the dashboard replaces this page. A single
    // navigation is enough: refresh() here would render the dashboard a second time.
    router.replace('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-round.png" alt="TradePilot logo" className="w-12 h-12 shrink-0 rounded-full object-cover" />
          <div>
            <h1 className="font-bold text-base">TradePilot</h1>
            <p className="text-xs text-muted">Business Console</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="field-label">
            Email
            <input
              type="email"
              className="field-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
          </label>

          <label className="field-label">
            Password
            <input
              type="password"
              className="field-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && <p className="text-sm text-red font-semibold">{error}</p>}

          <button type="submit" className="btn-primary mt-2" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <a href="/forgot-password" className="text-sm text-blue font-semibold text-center">
            Forgot password?
          </a>
        </form>
      </div>
    </div>
  );
}
