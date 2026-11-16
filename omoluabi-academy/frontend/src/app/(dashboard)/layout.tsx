import { logoutAction } from "@/app/actions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Sidebar } from "@/components/Sidebar";
import type { User } from "@/lib/api";
import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { BUILT_PAGES, NAV, REVIEWER_PAGES, type PageKey } from "@/lib/nav";
import { authedFetch } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getI18n();
  const me = await authedFetch<User>("/api/v1/auth/me");
  const labels = Object.fromEntries(NAV.map((n) => [n.key, t.nav[n.key]])) as Record<PageKey, string>;

  const footer = (
    <div className="space-y-3 text-sm">
      <LanguageSwitcher locale={locale} label={t.common.language} />
      {me.ok && (
        <p className="truncate text-xs text-navy-100/70">
          {t.common.signedInAs}{" "}
          <Link href="/account" className="text-cream underline decoration-gold/50 underline-offset-2">
            {me.data.display_name}
          </Link>
        </p>
      )}
      <form action={logoutAction}>
        <button
          type="submit"
          className="w-full rounded-md border border-gold/60 px-3 py-1.5 text-sm font-medium text-gold-300 hover:bg-gold hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          {t.common.logout}
        </button>
      </form>
    </div>
  );

  return (
    <div className="lg:flex">
      <Sidebar
        labels={labels}
        groupLabels={t.nav.groups}
        builtPages={BUILT_PAGES}
        visiblePages={me.ok && me.data.role === "reviewer" ? REVIEWER_PAGES : NAV.map((n) => n.key)}
        soonLabel={t.common.phase}
        menuLabel={t.common.menu}
        closeLabel={t.common.close}
        footer={footer}
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
