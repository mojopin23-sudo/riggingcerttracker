import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { importWorkbookFile } from "@/lib/import-workbook";

async function main() {
  const args = process.argv.slice(2);
  const replace = args.includes("--replace");
  const fileArg = args.find((arg) => !arg.startsWith("--"));
  const file = path.resolve(fileArg || path.join(process.cwd(), "seed", "rigging_certs.xlsx"));
  const db = getDb();
  try {
    const report = await importWorkbookFile(db, file, { replace });
    console.log(`File: ${file}`);
    console.log(`Units: ${report.units}`);
    console.log(`Lines: ${report.components}`);
    for (const [category, counts] of Object.entries(report.byCategory)) {
      console.log(`  ${category}: ${counts.units} units, ${counts.components} lines`);
    }
    const groups = ["error", "warning", "cleaned"] as const;
    for (const severity of groups) {
      const issues = report.issues.filter((issue) => issue.severity === severity);
      console.log(`\n${severity.toUpperCase()} (${issues.length})`);
      for (const issue of issues) {
        const where = [
          issue.sheet,
          issue.rowNumber ? `row ${issue.rowNumber}` : null,
          issue.unitNumber ? `unit ${issue.unitNumber}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        console.log(`- ${where}: ${issue.message}`);
      }
    }
  } finally {
    closeDb();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
