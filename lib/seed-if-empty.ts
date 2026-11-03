import path from "node:path";
import { countUnits, getDb } from "@/lib/db";
import { importWorkbookFile } from "@/lib/import-workbook";

export async function seedIfEmpty() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const db = getDb();
  if (countUnits(db) > 0) return;
  const file = path.join(process.cwd(), "seed", "rigging_certs.xlsx");
  console.log(`No units in the database. Importing ${file}`);
  const report = await importWorkbookFile(db, file);
  const errors = report.issues.filter((issue) => issue.severity === "error").length;
  const warnings = report.issues.filter((issue) => issue.severity === "warning").length;
  console.log(
    `Imported ${report.units} units and ${report.components} lines. ${errors} dates need a look, ${warnings} warnings.`,
  );
}
