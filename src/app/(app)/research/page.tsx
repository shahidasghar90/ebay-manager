import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { ResearchItem } from '@/lib/types';
import AddResearchButton from './AddResearchButton';
import ResearchTable from './ResearchTable';

export const dynamic = 'force-dynamic';

export default async function ResearchPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('product_research')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div>
      <PageHeader
        title="Product Research"
        subtitle="Save sourcing opportunities and product links"
      />

      <div className="grid gap-6">
        <AddResearchButton />
        <ResearchTable items={(data as ResearchItem[]) || []} />
      </div>
    </div>
  );
}
