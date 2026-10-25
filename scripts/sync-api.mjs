import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const source = process.env.API_SPEC_PATH
  ? resolve(process.env.API_SPEC_PATH)
  : resolve(repositoryRoot, "..", "ATMs", "api", "openapi.yaml");
const destination = resolve("api/openapi.yaml");
await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);

const result = spawnSync("pnpm", ["run", "gen:api"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
