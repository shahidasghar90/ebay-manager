import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { Order, ReturnCase } from '@/lib/types';
import ReturnForm from '../../ReturnForm';
import { RecordAuthorLine } from '@/components/RecordAuthor';

export default async function EditReturnPage({
  params
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from('returns_cases').select('*').eq('case_id', caseId).maybeSingle();

  if (!data) notFound();

  const returnCase = data as ReturnCase;
  const { data: order } = returnCase.order_id
    ? await supabase.from('orders').select('*').eq('order_id', returnCase.order_id).maybeSingle()
    : { data: null };

  return (
    <div>
      <PageHeader title={`Edit Return — ${returnCase.case_id}`} subtitle={returnCase.reason} />
      <RecordAuthorLine record={returnCase} />
      <ReturnForm returnCase={returnCase} orders={order ? [order as Order] : []} />
    </div>
  );
}
