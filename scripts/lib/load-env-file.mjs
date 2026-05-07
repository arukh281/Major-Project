import fs from "node:fs";

/**
 * Minimal KEY=value loader for local ingest/migration scripts.
 * Does not expand variable references; strips optional quotes.
 */
export function loadEnvFile(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Env file not found: ${path}`);
  }
  const raw = fs.readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) process.env[key] = val;
  }
}
