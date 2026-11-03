import path from "node:path";
import { closeDb, countUnits, getDb } from "@/lib/db";
import { importWorkbookFile } from "@/lib/import-workbook";

async function main() {
  const db = getDb();
  try {
    if (countUnits(db) > 0) return;
    const file = path.join(process.cwd(), "seed", "rigging_certs.xlsx");
    console.log(`No units in the database. Importing ${file}`);
    const report = await importWorkbookFile(db, file);
    const errors = report.issues.filter((issue) => issue.severity === "error").length;
    const warnings = report.issues.filter((issue) => issue.severity === "warning").length;
    console.log(
      `Imported ${report.units} units and ${report.components} lines. ${errors} dates need a look, ${warnings} warnings.`,
    );
  } finally {
    closeDb();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
