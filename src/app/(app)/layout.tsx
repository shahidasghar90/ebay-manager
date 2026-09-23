import AppShell from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  await supabase.rpc('ensure_my_workspace');

  return <AppShell>{children}</AppShell>;
}
