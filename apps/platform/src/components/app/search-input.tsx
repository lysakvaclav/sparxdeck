"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CrossIcon, SearchIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 300;

/**
 * Search box backed by the URL (?q=), so results are shareable and survive a
 * reload. Typing updates the URL after a short pause and resets to page 1.
 */
export function SearchInput({ placeholder }: { placeholder: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function navigate(query: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = query.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    params.delete("page");
    const search = params.toString();
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname));
  }

  function onChange(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate(next), DEBOUNCE_MS);
  }

  function clear() {
    clearTimeout(timer.current);
    setValue("");
    navigate("");
  }

  return (
    <form
      role="search"
      className="relative w-full sm:max-w-xs"
      onSubmit={(event) => {
        event.preventDefault();
        clearTimeout(timer.current);
        navigate(value);
      }}
    >
      <label htmlFor="search" className="sr-only">
        {t("search")}
      </label>
      {pending ? (
        <Spinner
          size={16}
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2"
        />
      ) : (
        <SearchIcon className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        id="search"
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        maxLength={100}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="ps-9 pe-9 pointer-coarse:pe-11 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label={t("clearSearch")}
          className="absolute end-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--btn-icon)] hover:bg-accent pointer-coarse:size-10"
        >
          <CrossIcon />
        </button>
      )}
    </form>
  );
}
