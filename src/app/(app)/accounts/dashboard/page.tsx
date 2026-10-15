import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { AccountTx } from '@/lib/types';
import HeadWiseDashboard from './HeadWiseDashboard';

export const dynamic = 'force-dynamic';

export default async function AccountsDashboardPage() {
  const supabase = await createClient();

  const { data: transactions } = await supabase
    .from('accounts')
    .select('*')
    .order('tx_date', { ascending: false });

  return (
    <div>
      <PageHeader
        title="Accounts Dashboard"
        subtitle="Income and expenses head wise"
        actions={
          <Link href="/accounts" className="btn-secondary">
            Ledger
          </Link>
        }
      />

      <HeadWiseDashboard transactions={(transactions as AccountTx[]) || []} />
    </div>
  );
}
