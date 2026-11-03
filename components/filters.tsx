import Link from "next/link";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import { cn } from "cn";

export function CategoryChips({
  base,
  category,
  extra,
}: {
  base: string;
  category: CategoryId | "all";
  extra?: Record<string, string | undefined>;
}) {
  const items = [{ id: "all" as const, label: "All" }, ...CATEGORIES.map((item) => ({ id: item.id, label: item.short }))];
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {items.map((item) => {
        const active = category === item.id;
        return (
          <Link
            key={item.id}
            href={withQuery(base, { ...extra, category: item.id === "all" ? undefined : item.id })}
            className={cn(
              "inline-flex min-h-12 shrink-0 items-center rounded-full px-4 text-base font-semibold",
              active ? "bg-[#1e2a24] text-white" : "bg-card text-foreground ring-1 ring-foreground/10",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function withQuery(base: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}
