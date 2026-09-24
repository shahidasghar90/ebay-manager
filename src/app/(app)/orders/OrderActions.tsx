'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/lib/types';
import { notifyTeam } from '@/lib/notify';

/** Close / Reopen / Edit / Cancel buttons for the order detail header. */
export default function OrderActions({ order }: { order: Order }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  const isClosed = !!order.closed_at;
  const isCancelled = order.order_status === 'Cancelled';
  const isReturned = order.order_status === 'Returned';

  async function run(fn: 'cancel_order' | 'reopen_order', question: string, title: string) {
    if (!window.confirm(question)) return;

    setBusy(true);
    const { error } = await supabase.rpc(fn, { p_order_id: order.order_id });
    setBusy(false);

    if (error) {
      window.alert(error.message);
      return;
    }

    notifyTeam(title, order.order_id, `/orders/${order.order_id}`);
    router.refresh();
  }

  return (
    <>
      {!isClosed && !isCancelled && (
        <Link href={`/orders/${order.order_id}/close`} className="btn-primary">
          Close Order
        </Link>
      )}
      {isClosed && (
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() =>
            run(
              'reopen_order',
              'Reopen this order? Its Sale, Fees, Shipping and Adjustment entries will be removed from Accounts.',
              'Order reopened'
            )
          }
        >
          Reopen
        </button>
      )}
      {!isClosed && !isCancelled && !isReturned && (
        <>
          <Link href={`/orders/${order.order_id}/edit`} className="btn-secondary">
            Edit
          </Link>
          <button
            type="button"
            className="btn-secondary hover:!border-red hover:!text-red"
            disabled={busy}
            onClick={() =>
              run('cancel_order', 'Cancel this order? Its stock goes back to inventory.', 'Order cancelled')
            }
          >
            Cancel Order
          </button>
        </>
      )}
      <Link href="/orders" className="btn-secondary">
        Back
      </Link>
    </>
  );
}
