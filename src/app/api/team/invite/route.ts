import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function generatePassword() {
  return Array.from({ length: 12 }, () => Math.random().toString(36).slice(2, 3)).join('') + 'A1!';
}

export async function POST(request: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server (.env.local). Restart the dev server after adding it.' },
        { status: 500 }
      );
    }

    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Only the workspace owner can invite members' }, { status: 403 });
    }

    const admin = createAdminClient();

    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers();

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 400 });
    }

    const existing = existingUsers?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    let targetUserId = existing?.id;
    let generatedPassword: string | null = null;

    if (!targetUserId) {
      generatedPassword = generatePassword();
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: generatedPassword,
        email_confirm: true
      });

      if (createError || !created.user) {
        return NextResponse.json({ error: createError?.message || 'Failed to create user' }, { status: 400 });
      }

      targetUserId = created.user.id;
    }

    await admin
      .from('workspace_members')
      .delete()
      .eq('user_id', targetUserId)
      .neq('workspace_id', membership.workspace_id);

    const { error: memberError } = await admin
      .from('workspace_members')
      .upsert(
        { workspace_id: membership.workspace_id, user_id: targetUserId, role: 'member' },
        { onConflict: 'workspace_id,user_id' }
      );

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 400 });
    }

    return NextResponse.json({
      email,
      password: generatedPassword,
      created: !existing
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown server error' },
      { status: 500 }
    );
  }
}
