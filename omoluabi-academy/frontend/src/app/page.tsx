import { StatusPill } from "@/components/StatusPill";
import { backendUrl, getReadiness } from "@/lib/api";

export const dynamic = "force-dynamic"; // always show live status, never a cached snapshot

export default async function SystemStatusPage() {
  const ready = await getReadiness();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-navy">System status</h1>
        <p className="mt-1 text-charcoal-400">
          Phase 1 foundation. The full dashboard (episodes, rights, scripts, publishing…) arrives in Phase 2.
        </p>
      </div>

      <div className="rounded-lg border border-navy-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-navy-700">Backend</h2>
        {ready.ok ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusPill ok={ready.data.status === "ok"} label="API" />
              {Object.entries(ready.data.checks).map(([name, check]) => (
                <StatusPill key={name} ok={check.ok} label={name} />
              ))}
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-charcoal-400">Environment</dt>
                <dd className="font-medium">{ready.data.environment}</dd>
              </div>
              <div>
                <dt className="text-charcoal-400">Provider mode</dt>
                <dd className="font-medium">
                  {ready.data.provider_mode === "sample" ? (
                    <span className="rounded bg-gold-100 px-2 py-0.5 text-gold-600">
                      SAMPLE — no paid APIs are called
                    </span>
                  ) : (
                    "LIVE"
                  )}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <p role="alert" className="text-red-800">
            {ready.error} at <code className="text-sm">{backendUrl()}</code>. No data is shown until the backend responds.
          </p>
        )}
      </div>
    </section>
  );
}
