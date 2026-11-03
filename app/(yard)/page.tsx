import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { bucketLabel, describeWhen, matchesWindow, type AttentionItem } from "@/lib/attention";
import { categoryById } from "@/lib/categories";
import { componentsByUnit, filterCategory, loadFleet, unitMatchesQuery } from "@/lib/fleet";
import { firstParam } from "@/lib/params";
import { CategoryChips, withQuery } from "@/components/filters";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Board" };

const WINDOWS = [
  { id: "urgent", label: "Urgent", hint: "Overdue, due within 30 days, or unreadable" },
  { id: "expired", label: "Expired", hint: "Already past due" },
  { id: "d30", label: "Within 30", hint: "Due in the next 30 days" },
  { id: "d60", label: "Within 60", hint: "Due in the next 60 days, including the 30-day list" },
  { id: "d90", label: "Within 90", hint: "Due in the next 90 days, including the 30- and 60-day lists" },
  { id: "missing", label: "Missing", hint: "No date on file" },
  { id: "review", label: "Review", hint: "Sheet dates that need a person" },
] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = firstParam(params.q)?.trim() ?? "";
  const category = filterCategory(firstParam(params.category));
  const window = WINDOWS.some((item) => item.id === firstParam(params.window))
    ? (firstParam(params.window) as (typeof WINDOWS)[number]["id"])
    : "urgent";

  const { units, components, attention } = loadFleet();
  const grouped = componentsByUnit(components);
  const visibleUnits = new Set(
    units
      .filter((unit) => category === "all" || unit.category === category)
      .filter((unit) => unitMatchesQuery(unit, grouped.get(unit.id) ?? [], query))
      .map((unit) => unit.id),
  );
  const scoped = attention.filter((item) => visibleUnits.has(item.unitId));
  const counts = Object.fromEntries(WINDOWS.map((item) => [item.id, scoped.filter((row) => matchesWindow(row, item.id)).length]));
  const current = scoped.filter((item) => item.bucket === "ok").length;
  const rows = scoped.filter((item) => matchesWindow(item, window));
  const active = WINDOWS.find((item) => item.id === window) ?? WINDOWS[0];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div>
        <h1 className="font-heading text-5xl leading-none font-bold tracking-wide">Yard board</h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Terminal 331, Jourdanton. {scoped.length} tracked dates across {visibleUnits.size} units.
          {current > 0 ? ` ${current} are current past 90 days.` : ""}
        </p>
      </div>

      <form action="/" className="flex gap-2">
        {category !== "all" ? <input type="hidden" name="category" value={category} /> : null}
        <input type="hidden" name="window" value={window} />
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Unit, plate, or line serial"
            aria-label="Search units"
            className="pl-10"
          />
        </div>
        <Button type="submit" size="yard">
          Search
        </Button>
      </form>

      <CategoryChips base="/" category={category} extra={{ q: query || undefined, window }} />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 xl:grid-cols-7">
        {WINDOWS.map((item) => {
          const selected = item.id === window;
          return (
            <Link
              key={item.id}
              href={withQuery("/", { q: query || undefined, category: category === "all" ? undefined : category, window: item.id })}
              className={`min-w-36 rounded-2xl p-3 ring-1 md:min-w-0 ${selected ? "bg-[#1e2a24] text-white ring-[#1e2a24]" : "bg-card ring-foreground/10"}`}
            >
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="font-heading mt-1 block text-4xl leading-none font-bold">{counts[item.id] ?? 0}</span>
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">{active.label}</h2>
          <p className="text-sm text-muted-foreground">{active.hint}</p>
        </div>
        {rows.length === 0 ? (
          <p className="rounded-2xl bg-card px-4 py-8 text-base ring-1 ring-foreground/10">
            {query
              ? `Nothing in ${active.label.toLowerCase()} matches “${query}”.`
              : `Nothing in ${active.label.toLowerCase()} for this filter.`}
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((item) => (
              <li key={item.key}>
                <AttentionRow item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const category = categoryById(item.category);
  const anchor = item.componentId ?? item.kind;
  return (
    <Link
      href={`/units/${item.unitId}#${anchor}`}
      className="flex min-h-20 items-center gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10 active:bg-muted"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-4xl leading-none font-bold tracking-wide">{item.unitNumber}</span>
          <span className="text-sm font-medium text-muted-foreground">{category?.short}</span>
          {item.plate ? <span className="truncate text-sm text-muted-foreground">{item.plate}</span> : null}
        </div>
        <p className="mt-1 truncate text-base font-medium">
          {item.label}
          {item.detail ? <span className="font-normal text-muted-foreground"> · {item.detail}</span> : null}
        </p>
        <p className="text-sm text-muted-foreground">{describeWhen(item)}</p>
      </div>
      <StatusPill bucket={item.bucket} status={item.status}>
        {item.status === "unparsed" ? "Check" : bucketLabel(item.bucket)}
      </StatusPill>
    </Link>
  );
}
