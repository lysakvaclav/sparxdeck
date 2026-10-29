"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { languageOptions, type Locale } from "@/i18n/dictionary";

interface LanguageSwitcherProps {
  locale: Locale;
}

export function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Bring the current language into view inside the scrollable list.
    activeRef.current?.scrollIntoView({ block: "nearest" });

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const current = languageOptions.find((l) => l.code === locale) ?? languageOptions[0];

  const handleSelect = (code: Locale) => {
    setOpen(false);
    if (!pathname) {
      router.push(`/${code}`);
      return;
    }

    const segments = pathname.split("/").filter(Boolean);
    const rest = segments.slice(1).join("/");
    const target = `/${code}` + (rest ? `/${rest}` : "");

    if (target !== pathname) {
      router.push(target);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="button-font btn btn-compact btn-square btn-header normal-case flex items-center gap-2 px-3 max-lg:min-h-11 max-lg:min-w-11"
        aria-label={current.nativeName}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="inline-block text-[12px] align-[-1px]">
          <span className={`fi fi-${current.flag}`} />
        </span>
        <span className="hidden sm:inline">{current.nativeName}</span>
      </button>
      {open && (
        <div className="absolute end-0 z-50 mt-2 max-h-[min(22rem,calc(100dvh-6rem))] w-48 overflow-y-auto overscroll-contain border border-[var(--color-border)] bg-[var(--color-card)] p-2 shadow-lg">
          <ul className="space-y-1" role="listbox">
            {languageOptions.map((lang) => (
              <li key={lang.code}>
                <button
                  type="button"
                  ref={lang.code === locale ? activeRef : undefined}
                  onClick={() => handleSelect(lang.code)}
                  className={`button-font flex w-full items-center justify-start gap-2 px-2 py-2 text-xs ${
                    lang.code === locale
                      ? "rounded-md bg-[var(--color-primary-soft)] text-[var(--color-text-strong)]"
                      : "rounded-md text-[var(--color-text-main)] hover:bg-[var(--color-card-muted)]"
                  }`}
                  role="option"
                  aria-selected={lang.code === locale}
                >
                  <span className="inline-block text-[12px] align-[-1px]">
                    <span className={`fi fi-${lang.flag}`} />
                  </span>
                  <span className="truncate">{lang.nativeName}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
