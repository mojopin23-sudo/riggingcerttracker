import { closeDb } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed-if-empty";

async function main() {
  try {
    await seedIfEmpty();
  } finally {
    closeDb();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
