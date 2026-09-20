import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { ReturnCase } from '@/lib/types';
import ReturnsTable from './ReturnsTable';

export const dynamic = 'force-dynamic';

export default async function ReturnsPage() {
  const supabase = await createClient();
  const { data: cases } = await supabase
    .from('returns_cases')
    .select('*')
    .order('case_date', { ascending: false });

  return (
    <div>
      <PageHeader
        title="Returns"
        subtitle="Track return cases and refunds"
        actions={
          <Link href="/returns/new" className="btn-primary">
            + Add Return
          </Link>
        }
      />

      <ReturnsTable cases={(cases as ReturnCase[]) || []} />
    </div>
  );
}
