import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const stand = path.join(root, ".next", "standalone");

if (!existsSync(path.join(stand, "server.js"))) {
  console.error("No standalone server. Run npm run build first.");
  process.exit(1);
}

cpSync(path.join(root, ".next", "static"), path.join(stand, ".next", "static"), { recursive: true });
cpSync(path.join(root, "public"), path.join(stand, "public"), { recursive: true });
cpSync(path.join(root, "seed"), path.join(stand, "seed"), { recursive: true });

const child = spawn(process.execPath, ["server.js"], {
  cwd: stand,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: "0.0.0.0",
    PORT: process.env.PORT || "43123",
    DATA_DIR: process.env.DATA_DIR || path.join(root, "data"),
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
