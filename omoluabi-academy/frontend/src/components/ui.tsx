export function PageHeader({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold text-navy sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-charcoal-400">{subtitle}</p>}
      </div>
      {badge}
    </header>
  );
}

export function Card({
  title,
  children,
  className = "",
  action,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={`rounded-lg border border-navy-100/70 bg-white p-5 shadow-sm ${className}`}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-navy-700">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Alert({ tone, children }: { tone: "error" | "warn" | "ok"; children: React.ReactNode }) {
  const styles = {
    error: "border-red-300 bg-red-50 text-red-900",
    warn: "border-gold-300 bg-gold-100/60 text-charcoal",
    ok: "border-emerald-300 bg-emerald-50 text-emerald-900",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}
