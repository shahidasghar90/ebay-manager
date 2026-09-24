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
  tone = 'default',
  className = ''
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}) {
  return (
    <article className={`card p-3 sm:p-[18px] min-w-0 ${className}`}>
      <span className="block text-muted text-xs sm:text-[13px] font-bold leading-tight">{label}</span>
      <strong className={`block my-1 sm:my-2 text-lg sm:text-[28px] leading-tight break-words ${TONE_CLASSES[tone]}`}>
        {value}
      </strong>
      {hint && <small className="block text-muted text-[11px] sm:text-xs leading-tight">{hint}</small>}
    </article>
  );
}
