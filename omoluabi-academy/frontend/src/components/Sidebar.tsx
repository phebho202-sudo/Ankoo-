"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV, type NavGroup, type PageKey } from "@/lib/nav";

type Props = {
  labels: Record<PageKey, string>;
  groupLabels: Record<NavGroup, string>;
  builtPages: PageKey[];
  soonLabel: string;
  menuLabel: string;
  closeLabel: string;
  footer: React.ReactNode;
};

const GROUP_ORDER: NavGroup[] = ["main", "content", "production", "distribution", "business", "system"];

export function Sidebar({ labels, groupLabels, builtPages, soonLabel, menuLabel, closeLabel, footer }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]); // close the mobile drawer after navigating

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const nav = (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-3">
      {GROUP_ORDER.map((group) => (
        <div key={group} className="mb-2.5">
          {group !== "main" && (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-navy-100/60">
              {groupLabels[group]}
            </p>
          )}
          <ul>
            {NAV.filter((n) => n.group === group).map((item) => {
              const active = isActive(item.href);
              const built = builtPages.includes(item.key);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`group flex items-center justify-between gap-2 rounded-md border-l-[3px] px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                      active
                        ? "border-gold bg-navy-700 font-semibold text-cream"
                        : "border-transparent text-navy-50/85 hover:bg-navy-700/60 hover:text-cream"
                    }`}
                  >
                    <span>{labels[item.key]}</span>
                    {!built && (
                      <span className="shrink-0 rounded bg-navy-900/70 px-1.5 py-0.5 text-[10px] font-medium text-gold-300">
                        {soonLabel.replace("{n}", String(item.phase))}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-gold bg-navy px-4 py-3 text-cream lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="whitespace-nowrap rounded-md border border-navy-100/30 px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          aria-expanded={open}
          aria-controls="sidebar"
        >
          {menuLabel}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-navy-900/60 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}

      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-navy text-cream shadow-xl transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-navy-700 px-5 py-4">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="whitespace-nowrap rounded px-2 py-1 text-sm text-navy-100 lg:hidden"
          >
            {closeLabel}
          </button>
        </div>
        {nav}
        <div className="border-t border-navy-700 px-5 py-4">{footer}</div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold">
      <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-gold font-display text-lg font-bold text-navy">
        Ọ
      </span>
      <span className="font-display text-[15px] font-semibold leading-tight tracking-wide">
        OMỌLÚÀBÍ
        <span className="block text-[11px] font-normal tracking-[0.18em] text-gold-300">BUSINESS ACADEMY</span>
      </span>
    </Link>
  );
}
