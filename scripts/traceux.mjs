import { existsSync, copyFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const envPath = `${rootPath}.env`;
const envExamplePath = `${rootPath}.env.example`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function executable(command) {
  return command === "npm" ? npmCommand : command;
}

function fail(message) {
  console.error(`\nTraceUX could not start: ${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(executable(command), args, {
    cwd: rootPath,
    env: process.env,
    stdio: "inherit",
    ...options,
  });

  if (result.error?.code === "ENOENT") {
    fail(`${command} is not installed or is not available in PATH.`);
  }

  if (result.status !== 0) {
    fail(`“${command} ${args.join(" ")}” exited with code ${result.status}.`);
  }
}

function commandWorks(command, args) {
  const result = spawnSync(executable(command), args, {
    cwd: rootPath,
    env: process.env,
    stdio: "ignore",
  });
  return result.status === 0;
}

if (!existsSync(envPath)) {
  copyFileSync(envExamplePath, envPath);
  console.log("Created .env from .env.example.");
  console.log("Live AI is optional: add a fresh OPENAI_API_KEY to .env, then restart TraceUX.");
}

process.loadEnvFile(envPath);

if (!commandWorks("docker", ["--version"])) {
  fail("Docker Desktop is required. Install/open Docker Desktop, then run npm run traceux again.");
}

if (!commandWorks("docker", ["info"])) {
  fail("Docker is installed but not running. Open Docker Desktop, then run npm run traceux again.");
}

console.log("\n[1/5] Installing application dependencies…");
run("npm", ["ci", "--no-audit", "--no-fund"]);
run("npm", ["--prefix", "api", "ci", "--no-audit", "--no-fund"]);
console.log("Installing the isolated Chromium browser (first launch only)…");
run("npm", ["--prefix", "api", "exec", "--", "playwright", "install", "chromium"]);

console.log("\n[2/5] Starting PostgreSQL…");
if (commandWorks("docker", ["container", "inspect", "traceux-postgres"])) {
  run("docker", ["start", "traceux-postgres"]);
} else {
  run("docker", [
    "run",
    "--name",
    "traceux-postgres",
    "--detach",
    "--publish",
    "5432:5432",
    "--env",
    "POSTGRES_USER=traceux",
    "--env",
    "POSTGRES_PASSWORD=traceux",
    "--env",
    "POSTGRES_DB=traceux",
    "--volume",
    "traceux_postgres:/var/lib/postgresql/data",
    "postgres:16-alpine",
  ]);
}

console.log("\n[3/5] Waiting for the database…");
let databaseReady = false;
for (let attempt = 0; attempt < 30; attempt += 1) {
  if (commandWorks("docker", ["exec", "traceux-postgres", "pg_isready", "-U", "traceux"])) {
    databaseReady = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}
if (!databaseReady) fail("PostgreSQL did not become ready within 30 seconds.");

console.log("\n[4/5] Preparing the database…");
run("npm", ["--prefix", "api", "run", "prisma:generate"]);
run("npm", ["--prefix", "api", "run", "prisma:deploy"]);
run("npm", ["--prefix", "api", "run", "prisma:seed"]);

const configuredKey = process.env.OPENAI_API_KEY?.trim();
if (configuredKey === "your_new_key_here") {
  delete process.env.OPENAI_API_KEY;
  console.warn("\nOPENAI_API_KEY still contains the example placeholder; using the safe fallback engine.");
}
const liveAi = process.env.AI_PROVIDER === "openai" && Boolean(process.env.OPENAI_API_KEY);
console.log(`\nAI mode: ${liveAi ? `${process.env.MODEL ?? "gpt-4o"} (live OpenAI)` : "safe deterministic fallback"}`);
console.log("\n[5/5] Starting TraceUX…");
console.log("Open http://localhost:3000 in your browser. Press Ctrl+C to stop.\n");

const children = [
  spawn(npmCommand, ["--prefix", "api", "run", "dev"], {
    cwd: rootPath,
    env: process.env,
    stdio: "inherit",
    detached: process.platform !== "win32",
  }),
  spawn(npmCommand, ["run", "dev"], {
    cwd: rootPath,
    env: process.env,
    stdio: "inherit",
    detached: process.platform !== "win32",
  }),
];

let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;

  for (const child of children) {
    if (!child.pid || child.killed) continue;
    try {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        process.kill(-child.pid, signal);
      }
    } catch {
      // The child may already have exited.
    }
  }
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

const exitCodes = await Promise.all(
  children.map(
    (child) =>
      new Promise((resolve) => {
        child.on("error", (error) => {
          console.error(error);
          stop();
          resolve(1);
        });
        child.on("exit", (code, signal) => {
          if (!stopping) stop();
          resolve(signal ? 0 : (code ?? 1));
        });
      }),
  ),
);

stop();
process.exit(exitCodes.find((code) => code !== 0) ?? 0);
