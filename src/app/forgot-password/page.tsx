'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
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
            <p className="text-xs text-muted">Reset password</p>
          </div>
        </div>

        {sent ? (
          <p className="text-sm">
            Agar us email sa account maujood hai, reset link bhej dia gaya hai. Apna
            inbox check karo.
          </p>
        ) : (
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

            {error && <p className="text-sm text-red font-semibold">{error}</p>}

            <button type="submit" className="btn-primary mt-2" disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <a href="/login" className="text-sm text-blue font-semibold text-center block mt-4">
          Back to login
        </a>
      </div>
    </div>
  );
}
