import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { mapSettingsRows } from '@/lib/settings';
import SettingsForm from './SettingsForm';
import PlatformSettings from './PlatformSettings';
import FulfillmentSettings from './FulfillmentSettings';
import TeamSettings from './TeamSettings';
import ChangePassword from './ChangePassword';
import { NotificationSettings } from '@/components/PushNotifications';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('settings').select('key, value');

  const settings = mapSettingsRows((data as { key: string; value: number }[]) || []);

  return (
    <div className="grid gap-6">
      <PageHeader title="Settings" subtitle="FX rates, platform fees, and VAT mode" />
      <SettingsForm settings={settings} />
      <PlatformSettings />
      <FulfillmentSettings />
      <NotificationSettings />
      <ChangePassword />
      <TeamSettings />
    </div>
  );
}
