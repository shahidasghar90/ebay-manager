import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { mapSettingsRows } from '@/lib/settings';
import type { AccountTx } from '@/lib/types';
import AccountsTable from './AccountsTable';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const supabase = await createClient();

  const [{ data: transactions }, { data: settingsRows }] = await Promise.all([
    supabase.from('accounts').select('*').order('tx_date', { ascending: false }),
    supabase.from('settings').select('key, value')
  ]);

  const settings = mapSettingsRows((settingsRows as { key: string; value: number }[]) || []);

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Income and expense ledger"
        actions={
          <Link href="/accounts/new" className="btn-primary">
            + Add Transaction
          </Link>
        }
      />

      <AccountsTable
        transactions={(transactions as AccountTx[]) || []}
        vatRegistered={settings.vatRegistered}
      />
    </div>
  );
}
