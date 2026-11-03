import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { buildAttention, bucketLabel, describeWhen, worstItem } from "@/lib/attention";
import { categoryById } from "@/lib/categories";
import { componentsByUnit, filterCategory, loadFleet, unitMatchesQuery } from "@/lib/fleet";
import { firstParam } from "@/lib/params";
import { CategoryChips } from "@/components/filters";
import { StatusPill } from "@/components/status-pill";
import { Banner } from "@/components/banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Units" };

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = firstParam(params.q)?.trim() ?? "";
  const category = filterCategory(firstParam(params.category));
  const { units, components } = loadFleet();
  const grouped = componentsByUnit(components);
  const rows = units.filter((unit) => {
    if (category !== "all" && unit.category !== category) return false;
    return unitMatchesQuery(unit, grouped.get(unit.id) ?? [], query);
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-5xl leading-none font-bold tracking-wide">Units</h1>
          <p className="mt-2 text-base text-muted-foreground">{rows.length} on this list.</p>
        </div>
        <Button render={<Link href="/units/new" />} size="yard">
          Add unit
        </Button>
      </div>
      <Banner saved={firstParam(params.saved) === "1"} error={firstParam(params.error)} />
      <form action="/units" className="flex gap-2">
        {category !== "all" ? <input type="hidden" name="category" value={category} /> : null}
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" type="search" defaultValue={query} placeholder="Unit, plate, or line serial" aria-label="Search units" className="pl-10" />
        </div>
        <Button type="submit" size="yard">
          Search
        </Button>
      </form>
      <CategoryChips base="/units" category={category} extra={{ q: query || undefined }} />
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-8 text-base ring-1 ring-foreground/10">
          {query ? `No unit matches “${query}”.` : "No units in this category yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((unit) => {
            const lines = grouped.get(unit.id) ?? [];
            const worst = worstItem(buildAttention([unit], lines));
            const categoryInfo = categoryById(unit.category);
            return (
              <li key={unit.id}>
                <Link
                  href={`/units/${unit.id}`}
                  className="flex min-h-20 items-center gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10 active:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-heading text-4xl leading-none font-bold tracking-wide">{unit.number}</span>
                      <span className="text-sm font-medium text-muted-foreground">{categoryInfo?.short}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {unit.plate ? `Plate ${unit.plate}` : "No plate"}
                      {unit.slickBack ? " · Slick back" : ""}
                      {lines.length > 0 ? ` · ${lines.length} line${lines.length === 1 ? "" : "s"}` : ""}
                    </p>
                    {worst ? <p className="truncate text-sm">{describeWhen(worst)} · {worst.label}</p> : null}
                  </div>
                  {worst ? (
                    <StatusPill bucket={worst.bucket} status={worst.status}>
                      {worst.status === "unparsed" ? "Check" : bucketLabel(worst.bucket)}
                    </StatusPill>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
