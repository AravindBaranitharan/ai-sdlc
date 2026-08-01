import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the TraceUX product experience without starter artifacts", async () => {
  const [page, shell, layout, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/product-shell.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(page, /ProductShell/);
  assert.match(shell, /Catch the moment users get stuck/i);
  assert.match(shell, /Scenario studio/i);
  assert.match(shell, /Run command center/i);
  assert.match(shell, /Verified UX findings/i);
  assert.match(shell, /Persona lab/i);
  assert.match(layout, /TraceUX — AI Human Behavior Testing/);
  assert.match(layout, /og\.png/);
  assert.match(packageJson, /lucide-react/);
  assert.doesNotMatch(`${page}\n${shell}\n${layout}\n${packageJson}`, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
