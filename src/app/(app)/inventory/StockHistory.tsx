import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import type { StockMovement } from '@/lib/types';

const REASON_LABELS: Record<StockMovement['reason'], string> = {
  opening: 'Opening stock',
  purchase: 'Purchase',
  sale: 'Sale',
  cancel: 'Order cancelled',
  return: 'Return',
  adjust: 'Count correction'
};

function refLink(movement: StockMovement) {
  if (movement.ref_type === 'order' && movement.ref_id) return `/orders/${movement.ref_id}`;
  if (movement.ref_type === 'return' && movement.ref_id) return `/returns/${movement.ref_id}/edit`;
  return null;
}

/** Last 50 stock changes for a SKU; one list that works on phones and desktop. */
export default async function StockHistory({ sku }: { sku: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('sku', sku)
    .order('created_at', { ascending: false })
    .limit(50);

  const movements = (data as StockMovement[]) || [];

  return (
    <div className="card p-5 max-w-2xl">
      <h3 className="font-bold text-base m-0 mb-3.5">Stock History</h3>
      {movements.length === 0 ? (
        <p className="text-muted text-sm m-0">No stock changes recorded yet.</p>
      ) : (
        <ul className="grid gap-0 m-0 p-0 list-none text-sm">
          {movements.map((movement) => {
            const href = refLink(movement);
            return (
              <li
                key={movement.id}
                className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0"
              >
                <span className="min-w-0">
                  <strong className="block">{REASON_LABELS[movement.reason]}</strong>
                  <span className="block text-xs text-muted truncate">
                    {formatDate(movement.created_at)}
                    {href && (
                      <>
                        {' · '}
                        <Link href={href} className="hover:text-blue">
                          {movement.ref_id}
                        </Link>
                      </>
                    )}
                    {movement.notes ? ` · ${movement.notes}` : ''}
                    {movement.created_by ? ` · ${movement.created_by.split('@')[0]}` : ''}
                  </span>
                </span>
                <strong className={`shrink-0 ${movement.qty_change < 0 ? 'text-red' : 'text-green'}`}>
                  {movement.qty_change > 0 ? '+' : ''}
                  {movement.qty_change}
                </strong>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
