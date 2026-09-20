export function formatMoney(value: number | null | undefined) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('de-DE').format(date);
}

export function statusClassName(value: string | null | undefined) {
  const text = (value || '').toLowerCase().replace(/\s+/g, '-');
  return `status-badge status-${text}`;
}
