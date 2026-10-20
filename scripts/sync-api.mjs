import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const source = resolve(process.env.API_SPEC_PATH ?? "../attendance-api/api/openapi.yaml");
const destination = resolve("api/openapi.yaml");
await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);

const result = spawnSync("pnpm", ["run", "gen:api"], { stdio: "inherit", shell: process.platform === "win32" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
