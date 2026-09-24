'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatMoney, statusClassName } from '@/lib/format';
import { summarizeCompetitorPrices } from '@/lib/competitorStats';
import type { ResearchItem } from '@/lib/types';
import { RecordAuthorCell, RecordAuthorShort } from '@/components/RecordAuthor';

export default function ResearchTable({ items }: { items: ResearchItem[] }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (items.length === 0) {
    return <div className="card p-6 text-center text-muted">No research records yet.</div>;
  }

  return (
    <div>
      {/* Phones: one compact card per research idea. */}
      <ul className="md:hidden grid gap-2.5">
        {items.map((item) => {
          const stats = summarizeCompetitorPrices(item.competitor_prices || []);
          return (
            <li key={item.id} className="card p-3 flex gap-3">
              {item.image_url ? (
                <button
                  type="button"
                  onClick={() => setPreviewUrl(item.image_url)}
                  className="shrink-0 cursor-zoom-in"
                  aria-label={`View image for ${item.keyword}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image_url}
                    alt=""
                    className="w-16 h-16 object-cover rounded-lg border border-border"
                  />
                </button>
              ) : (
                <div className="w-16 h-16 shrink-0 rounded-lg bg-slate-100 grid place-items-center text-slate-400 text-[10px]">
                  No image
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/research/${item.id}`}
                    className="font-bold text-sm leading-snug line-clamp-2 break-words"
                  >
                    {item.keyword}
                  </Link>
                  <span className={`${statusClassName(item.research_status)} shrink-0`}>
                    {item.research_status}
                  </span>
                </div>
                <p className="text-muted text-xs m-0 mt-0.5 truncate">
                  {item.potential_model} · Price {formatMoney(item.product_price_local)}
                </p>
                {stats.min != null && (
                  <p className="text-[13px] m-0 mt-1 truncate">
                    Competitors {formatMoney(stats.min)} / {formatMoney(stats.avg!)} / {formatMoney(stats.max!)}
                  </p>
                )}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <RecordAuthorShort record={item} />
                  <div className="flex gap-1.5 shrink-0">
                    <Link href={`/research/${item.id}`} className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue">
                      Edit
                    </Link>
                    <Link href={`/products/new?researchId=${item.id}`} className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue">
                      Convert
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden md:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-sm md:min-w-[640px]">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                <th className="p-3">Image</th>
                <th className="p-3">Keyword</th>
                <th className="p-3">Model</th>
                <th className="p-3">Price</th>
                <th className="p-3">Competitor Min/Avg/Max</th>
                <th className="p-3">Last Edited</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="p-3 cell-image">
                    {item.image_url ? (
                      <button
                        type="button"
                        onClick={() => setPreviewUrl(item.image_url)}
                        className="block cursor-zoom-in"
                        aria-label={`View image for ${item.keyword}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image_url}
                          alt=""
                          className="w-12 h-12 object-cover rounded border border-border"
                        />
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded bg-slate-100 grid place-items-center text-slate-400 text-[10px]">
                        No image
                      </div>
                    )}
                  </td>
                  <td className="p-3" data-label="Keyword">{item.keyword}</td>
                  <td className="p-3" data-label="Model">{item.potential_model}</td>
                  <td className="p-3" data-label="Price">{formatMoney(item.product_price_local)}</td>
                  <td className="p-3" data-label="Competitor Min/Avg/Max">
                    {(() => {
                      const stats = summarizeCompetitorPrices(item.competitor_prices || []);
                      if (stats.min == null) return '—';
                      return `${formatMoney(stats.min)} / ${formatMoney(stats.avg!)} / ${formatMoney(stats.max!)}`;
                    })()}
                  </td>
                  <td className="p-3" data-label="Last Edited">
                    <RecordAuthorCell record={item} />
                  </td>
                  <td className="p-3" data-label="Status">
                    <span className={statusClassName(item.research_status)}>
                      {item.research_status}
                    </span>
                  </td>
                  <td className="p-3 cell-actions">
                    <div className="flex gap-2">
                      <Link
                        href={`/research/${item.id}`}
                        className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/products/new?researchId=${item.id}`}
                        className="text-xs font-bold border border-border rounded px-2.5 py-1.5 hover:border-blue hover:text-blue"
                      >
                        Convert to Product
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4 cursor-zoom-out"
          onClick={() => setPreviewUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Research product"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
