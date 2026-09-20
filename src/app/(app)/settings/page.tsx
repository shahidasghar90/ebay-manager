import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { mapSettingsRows } from '@/lib/settings';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('settings').select('key, value');

  const settings = mapSettingsRows((data as { key: string; value: number }[]) || []);

  return (
    <div>
      <PageHeader title="Settings" subtitle="FX rates, platform fees, and VAT mode" />
      <SettingsForm settings={settings} />
    </div>
  );
}
