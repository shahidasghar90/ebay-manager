'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ChangePassword() {
  const supabase = createClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSaved(false);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user?.email) {
      setSaving(false);
      setError('Could not verify your account. Please re-login and try again.');
      return;
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });

    if (verifyError) {
      setSaving(false);
      setError('Current password is incorrect.');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setCurrentPassword('');
    setPassword('');
    setConfirmPassword('');
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 grid gap-3.5 max-w-2xl">
      <div>
        <h2 className="font-bold text-base">Change Password</h2>
        <p className="text-muted text-sm">Update the password for your own login.</p>
      </div>

      <label className="field-label">
        Current password
        <input
          className="field-input"
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </label>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <label className="field-label">
          New password
          <input
            className="field-input"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <label className="field-label">
          Confirm password
          <input
            className="field-input"
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="text-red font-semibold text-sm">{error}</p>}
      {saved && <p className="text-green font-semibold text-sm">Password updated.</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Update Password'}
        </button>
      </div>
    </form>
  );
}
