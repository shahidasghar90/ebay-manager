import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { Order } from '@/lib/types';
import ReturnForm from '../ReturnForm';

export default async function NewReturnPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .neq('order_status', 'Cancelled')
    .order('order_date', { ascending: false });

  return (
    <div>
      <PageHeader title="Add Return" subtitle="Log a return case and refund" />
      <ReturnForm orders={(orders as Order[]) || []} />
    </div>
  );
}
