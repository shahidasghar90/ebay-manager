const TONE_CLASSES: Record<string, string> = {
  default: 'text-text',
  success: 'text-green',
  warning: 'text-orange',
  danger: 'text-red'
};

export default function StatCard({
  label,
  value,
  hint,
  tone = 'default'
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  return (
    <article className="card p-4.5 p-[18px]">
      <span className="text-muted text-[13px] font-bold">{label}</span>
      <strong className={`block my-2 text-[28px] ${TONE_CLASSES[tone]}`}>{value}</strong>
      {hint && <small className="text-muted">{hint}</small>}
    </article>
  );
}
