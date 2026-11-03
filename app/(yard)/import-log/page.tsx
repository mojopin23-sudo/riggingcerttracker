import type { Metadata } from "next";
import Link from "next/link";
import { importLog, loadFleet } from "@/lib/fleet";

export const metadata: Metadata = { title: "Sheet log" };

const ORDER = ["error", "warning", "cleaned"] as const;
const TITLES = {
  error: "Could not read",
  warning: "Imported, but check it",
  cleaned: "Cleaned up on the way in",
};

export default function ImportLogPage() {
  const issues = importLog();
  const { units } = loadFleet();
  const byNumber = new Map(units.map((unit) => [`${unit.sourceSheet ?? ""}:${unit.number}`, unit]));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="font-heading text-5xl leading-none font-bold tracking-wide">Sheet log</h1>
        <p className="mt-2 text-base text-muted-foreground">
          What the importer did with the rigging spreadsheet. Fix a date on the unit and it drops off the yard board.
          This log stays until you import the sheet again with <span className="font-medium text-foreground">--replace</span>.
        </p>
      </div>
      {issues.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-8 text-base ring-1 ring-foreground/10">
          No import notes yet. Run <span className="font-medium">npm run import</span> to load a workbook.
        </p>
      ) : (
        ORDER.map((severity) => {
          const rows = issues.filter((issue) => issue.severity === severity);
          if (rows.length === 0) return null;
          return (
            <section key={severity} className="space-y-2">
              <h2 className="text-xl font-semibold">
                {TITLES[severity]} <span className="text-muted-foreground">({rows.length})</span>
              </h2>
              <ul className="space-y-2">
                {rows.map((issue) => {
                  const unit = issue.unitNumber ? byNumber.get(`${issue.sheet}:${issue.unitNumber}`) : undefined;
                  return (
                    <li key={issue.id} className="rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
                      <p className="text-sm font-semibold text-muted-foreground">
                        {issue.sheet}
                        {issue.rowNumber ? ` · row ${issue.rowNumber}` : ""}
                        {issue.unitNumber ? ` · unit ${issue.unitNumber}` : ""}
                        {issue.field ? ` · ${issue.field}` : ""}
                      </p>
                      <p className="mt-1 text-base">{issue.message}</p>
                      {issue.rawValue ? <p className="mt-1 text-sm text-muted-foreground">Sheet value: {issue.rawValue}</p> : null}
                      {unit ? (
                        <Link href={`/units/${unit.id}`} className="mt-2 inline-flex min-h-11 items-center text-base font-semibold text-[#9a3412]">
                          Open unit {unit.number}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
