import { test } from "node:test";
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { searchForWorkspaceRoot } from "vite";
import viteConfig from "../vite.config.ts";

test("Vite allows the workspace and the resolved target of linked frontend dependencies", async () => {
  const previousDirectory = process.cwd();
  const frontendDirectory = resolve(import.meta.dirname, "..");
  try {
    process.chdir(frontendDirectory);
    const config = await viteConfig({ command: "serve", mode: "development" });
    const allowed = config.server?.fs?.allow;

    assert.ok(allowed?.includes(searchForWorkspaceRoot(frontendDirectory)));
    assert.ok(allowed?.includes(realpathSync("node_modules")));
  } finally {
    process.chdir(previousDirectory);
  }
});
