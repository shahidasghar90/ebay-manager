import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { AccountTx } from '@/lib/types';
import AccountsForm from '../../AccountsForm';

export default async function EditAccountsTxPage({
  params
}: {
  params: Promise<{ txId: string }>;
}) {
  const { txId } = await params;
  const supabase = await createClient();
  const { data: tx } = await supabase.from('accounts').select('*').eq('tx_id', txId).maybeSingle();

  if (!tx) notFound();

  return (
    <div>
      <PageHeader title={`Edit Transaction — ${tx.tx_id}`} subtitle={tx.category} />
      <AccountsForm tx={tx as AccountTx} />
    </div>
  );
}
