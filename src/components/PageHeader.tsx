export default function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4 md:mb-6">
      <div className="min-w-0">
        <h2 className="text-xl md:text-[27px] font-bold m-0 break-words">{title}</h2>
        {/* Phones need the space for content; the title says enough there. */}
        <p className="hidden sm:block text-muted mt-1.5 m-0">{subtitle}</p>
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
