"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Read/write a single URL query param so view state (tab, filter, search,
 * selection) survives reload and is shareable. Setting to the fallback value
 * removes the param to keep URLs clean.
 *
 * The component using this MUST be rendered inside a <Suspense> boundary
 * (Next.js requirement for useSearchParams).
 */
export function useUrlParam(
  key: string,
  fallback = ""
): readonly [string, (v: string) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const value = params.get(key) ?? fallback;

  const set = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v && v !== fallback) next.set(key, v);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return [value, set] as const;
}
