import type { RecordAuthor } from '@/lib/types';

function shortName(email: string) {
  return email.split('@')[0];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value)
  );
}

/** "Created by ali · Last edited by sara, 24.09.26, 15:02" for detail and edit pages. */
export function RecordAuthorLine({ record }: { record: RecordAuthor }) {
  if (!record.created_by && !record.updated_by) return null;

  const edited = record.updated_by && record.updated_by !== record.created_by;

  return (
    <p className="text-muted text-[13px] -mt-3 mb-5">
      {record.created_by && (
        <>
          Created by <strong className="text-text">{record.created_by}</strong>
        </>
      )}
      {record.created_by && record.updated_by && ' · '}
      {record.updated_by && (
        <>
          {edited || !record.created_by ? 'Last edited by ' : 'Last saved by '}
          <strong className="text-text">{record.updated_by}</strong>
          {record.updated_at && `, ${formatDateTime(record.updated_at)}`}
        </>
      )}
    </p>
  );
}

/** Compact "sara · 24.09.26, 15:02" for list tables. */
export function RecordAuthorCell({ record }: { record: RecordAuthor }) {
  const who = record.updated_by || record.created_by;
  if (!who) return <>—</>;

  return (
    <span className="text-xs" title={who}>
      <strong>{shortName(who)}</strong>
      {record.updated_at && (
        <span className="text-muted block">{formatDateTime(record.updated_at)}</span>
      )}
    </span>
  );
}
