'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Member = { email: string; role: string };

export default function TeamSettings() {
  const supabase = createClient();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newCredentials, setNewCredentials] = useState<{ email: string; password: string } | null>(
    null
  );

  async function loadMembers() {
    const { data } = await supabase.rpc('list_workspace_members');
    setMembers((data as Member[]) || []);
  }

  useEffect(() => {
    loadMembers();
  }, []);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setInviting(true);
    setError('');
    setMessage('');
    setNewCredentials(null);

    const response = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const result = await response.json();

    setInviting(false);

    if (!response.ok) {
      setError(result.error || 'Failed to invite');
      return;
    }

    if (result.created && result.password) {
      setNewCredentials({ email: result.email, password: result.password });
    } else {
      setMessage(`${email} now has access to this workspace.`);
    }

    setEmail('');
    loadMembers();
  }

  return (
    <div className="card p-5 grid gap-3.5 max-w-2xl">
      <div>
        <h2 className="font-bold text-base">Team Access</h2>
        <p className="text-muted text-sm">
          Invite someone to share this workspace&apos;s data. If they don&apos;t have a login yet,
          one is created automatically with a generated password.
        </p>
      </div>

      <form onSubmit={handleInvite} className="flex gap-2">
        <input
          className="field-input"
          type="email"
          required
          placeholder="teammate@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="btn-primary whitespace-nowrap" disabled={inviting}>
          {inviting ? 'Inviting...' : 'Invite'}
        </button>
      </form>

      {error && <p className="text-red font-semibold text-sm">{error}</p>}
      {message && <p className="text-green font-semibold text-sm">{message}</p>}

      {newCredentials && (
        <div className="bg-slate-50 border border-border rounded-lg p-3 text-sm grid gap-1">
          <p className="font-semibold text-green">Account created — share these login details:</p>
          <p>
            Email: <span className="font-mono">{newCredentials.email}</span>
          </p>
          <p>
            Password: <span className="font-mono">{newCredentials.password}</span>
          </p>
          <p className="text-muted text-[13px]">
            This password is shown only once. Ask them to change it after logging in.
          </p>
        </div>
      )}

      <div className="border-t border-border pt-3.5">
        <p className="text-sm font-semibold mb-2">Members with access</p>
        {members === null ? (
          <p className="text-muted text-sm">Loading...</p>
        ) : members.length === 0 ? (
          <p className="text-muted text-sm">No members yet.</p>
        ) : (
          <ul className="grid gap-1.5">
            {members.map((member) => (
              <li key={member.email} className="flex justify-between text-sm">
                <span>{member.email}</span>
                <span className="text-muted capitalize">{member.role}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
