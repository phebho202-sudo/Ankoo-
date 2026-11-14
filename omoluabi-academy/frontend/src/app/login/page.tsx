import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getI18n } from "@/lib/i18n/server";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { locale, t } = await getI18n();
  const { expired } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-cream">
          <span aria-hidden className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-gold font-display text-3xl font-bold text-navy">
            Ọ
          </span>
          <p className="font-display text-xl font-semibold tracking-wide">{t.common.appName}</p>
          <p className="mt-1 text-sm text-gold-300">{t.common.tagline}</p>
        </div>
        <div className="rounded-xl border-t-4 border-gold bg-cream p-6 shadow-2xl sm:p-8">
          <h1 className="mb-5 font-display text-xl font-semibold text-navy">{t.login.title}</h1>
          {expired && (
            <p role="status" className="mb-4 rounded-md border border-gold-300 bg-gold-100/60 px-3 py-2 text-sm">
              {t.login.expired}
            </p>
          )}
          <LoginForm labels={t.login} />
        </div>
        <div className="mt-5 flex justify-center">
          <LanguageSwitcher locale={locale} label={t.common.language} />
        </div>
      </div>
    </div>
  );
}
