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

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "gold" | "green" | "red" | "navy";
  children: React.ReactNode;
}) {
  const styles = {
    neutral: "bg-navy-50 text-navy-700",
    gold: "bg-gold-100 text-gold-600",
    green: "bg-emerald-100 text-emerald-900",
    red: "bg-red-100 text-red-900",
    navy: "bg-navy text-cream",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${styles}`}>
      {children}
    </span>
  );
}

export const inputClass =
  "w-full rounded-md border border-navy-100 bg-white px-3 py-2 text-sm shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40";

export const buttonClass =
  "rounded-md bg-navy px-4 py-2 text-sm font-semibold text-cream hover:bg-navy-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60";

export const secondaryButtonClass =
  "rounded-md border border-navy-100 bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-cream-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60";
