import { setLanguageAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n/dictionaries";

export function LanguageSwitcher({
  locale,
  label,
  tone = "dark",
}: {
  locale: Locale;
  label: string;
  tone?: "dark" | "light";
}) {
  const options: { value: Locale; text: string }[] = [
    { value: "en", text: "English" },
    { value: "yo", text: "Yorùbá" },
  ];
  const base = tone === "dark" ? "border-navy-100/30 text-navy-50" : "border-navy-100 text-navy";
  return (
    <form action={setLanguageAction} className="flex items-center gap-2" aria-label={label}>
      <span className={`text-xs ${tone === "dark" ? "text-navy-100/70" : "text-charcoal-400"}`}>{label}</span>
      <div className={`flex overflow-hidden rounded-md border ${base}`} role="group">
        {options.map((o) => (
          <button
            key={o.value}
            type="submit"
            name="lang"
            value={o.value}
            lang={o.value}
            aria-pressed={locale === o.value}
            className={`px-2.5 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
              locale === o.value ? "bg-gold text-navy" : "hover:bg-gold/20"
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </form>
  );
}
