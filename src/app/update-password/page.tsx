'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords match nahi kar rahay');
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-blue text-white grid place-items-center font-bold text-xl">
            T
          </div>
          <div>
            <h1 className="font-bold text-base">TradePilot</h1>
            <p className="text-xs text-muted">Set new password</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="field-label">
            New password
            <input
              type="password"
              className="field-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              autoFocus
            />
          </label>

          <label className="field-label">
            Confirm password
            <input
              type="password"
              className="field-input"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={6}
            />
          </label>

          {error && <p className="text-sm text-red font-semibold">{error}</p>}

          <button type="submit" className="btn-primary mt-2" disabled={loading}>
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
