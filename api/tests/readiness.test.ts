import { afterEach, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHealthRouter } from "../src/routes/health.js";
import { createApp } from "../src/app.js";
import { openStakeDeposits } from "../../vault/stake-deposits.mjs";

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const close of cleanup.splice(0).reverse()) close();
});

function healthApp(overrides: {
  database?: boolean;
  vault?: boolean;
  qvac?: boolean;
  rgb?: boolean;
} = {}) {
  const app = express();
  app.use("/api/health", createHealthRouter({
    database: () => overrides.database ?? true,
    vault: async () => overrides.vault ?? true,
    qvacRgb: async () => ({
      qvac: overrides.qvac ?? true,
      rgb: overrides.rgb ?? true,
    }),
  }));
  return app;
}

it("reports ready only when database, vault, QVAC, and RGB checks pass", async () => {
  const response = await request(healthApp()).get("/api/health/ready");
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    status: "ready",
    checks: { database: "ok", vault: "ok", qvac: "ok", rgb: "ok" },
  });
});

it("keeps liveness green and hides check errors while any dependency is unavailable", async () => {
  for (const [dependency, expected] of [
    ["database", { database: "unavailable", vault: "ok", qvac: "ok", rgb: "ok" }],
    ["vault", { database: "ok", vault: "unavailable", qvac: "ok", rgb: "ok" }],
    ["qvac", { database: "ok", vault: "ok", qvac: "unavailable", rgb: "ok" }],
    ["rgb", { database: "ok", vault: "ok", qvac: "ok", rgb: "unavailable" }],
  ] as const) {
    const response = await request(healthApp({ [dependency]: false })).get("/api/health/ready");
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "unavailable", checks: expected });
    expect(JSON.stringify(response.body)).not.toContain("secret");
    expect((await request(healthApp({ [dependency]: false })).get("/api/health")).body).toEqual({ status: "ok" });
  }
});

it("marks dependent checks unavailable instead of exposing thrown errors", async () => {
  const app = express();
  app.use("/api/health", createHealthRouter({
    database: () => { throw new Error("database-secret"); },
    vault: async () => { throw new Error("vault-secret"); },
    qvacRgb: async () => { throw new Error("qvac-secret"); },
  }));
  const response = await request(app).get("/api/health/ready");
  expect(response.status).toBe(503);
  expect(response.body.checks).toEqual({
    database: "unavailable",
    vault: "unavailable",
    qvac: "unavailable",
    rgb: "unavailable",
  });
  expect(JSON.stringify(response.body)).not.toMatch(/secret/);
});

it("wires the real API readiness route to database, authenticated vault, and QVAC health", async () => {
  const directory = mkdtempSync(join(tmpdir(), "api-readiness-"));
  const databasePath = join(directory, "api.sqlite");
  const seenVaultHeaders: string[] = [];
  const stakes = openStakeDeposits({
    databasePath,
    token: "readiness-private-token",
    fetchService: async (_url, init) => {
      seenVaultHeaders.push(new Headers(init?.headers).get("Authorization") ?? "");
      return Response.json({ status: "ok" });
    },
  });
  const seenQvacUrls: string[] = [];
  const app = createApp({
    databasePath,
    stakeDeposits: stakes,
    readinessFetch: async (url) => {
      seenQvacUrls.push(String(url));
      return Response.json({
        status: "ok",
        qvac: { status: "ok" },
        rgb: { status: "ok" },
      });
    },
  });
  cleanup.push(() => app.locals.close());
  cleanup.push(() => stakes.close());
  cleanup.push(() => rmSync(directory, { recursive: true }));

  const response = await request(app).get("/api/health/ready");
  expect(response.status).toBe(200);
  expect(response.body.status).toBe("ready");
  expect(seenVaultHeaders).toEqual(["Bearer readiness-private-token"]);
  expect(seenQvacUrls).toEqual(["http://127.0.0.1:4000/health"]);
  expect(JSON.stringify(response.body)).not.toContain("readiness-private-token");
});
