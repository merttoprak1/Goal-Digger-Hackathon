import { afterEach, describe, it, expect } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../src/app.js";
const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0).reverse()) fn();
});
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "goal-digger-api-"));
  cleanup.push(() => rmSync(dir, { recursive: true }));
  const databasePath = join(dir, "api.sqlite");
  const app = createApp({ databasePath });
  cleanup.push(() => app.locals.sessionStore.close());
  return { app, databasePath };
}
describe("participant sessions", () => {
  it("creates a server identity and requires its private bearer token", async () => {
    const { app } = fixture();
    const response = await request(app)
      .post("/api/sessions")
      .send({ displayName: "Mert" });
    expect(response.status).toBe(201);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.participant.displayName).toBe("Mert");
    expect(response.body.participant.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(response.body.token).toMatch(/^[a-f0-9]{64}$/);
    expect((await request(app).get("/api/me")).status).toBe(401);
    expect(
      (await request(app).get("/api/me").set("Authorization", "Bearer wrong")).status,
    ).toBe(401);
    const me = await request(app)
      .get("/api/me")
      .set("Authorization", `Bearer ${response.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.participant).toEqual(response.body.participant);
    expect(me.body.token).toBeUndefined();
  });
  it("rejects supplied identities, invalid names, and oversized payloads", async () => {
    const { app } = fixture();
    for (const body of [
      { displayName: "" },
      { displayName: " " },
      { displayName: "x".repeat(61) },
      { displayName: "Mert", participantId: "chosen" },
      null,
      [],
    ]) {
      expect((await request(app).post("/api/sessions").send(body)).status).toBe(400);
    }
    expect(
      (
        await request(app)
          .post("/api/sessions")
          .send({ displayName: "x".repeat(5000) })
      ).status,
    ).toBe(413);
  });
  it("does not impersonate another participant with the same display name", async () => {
    const { app } = fixture();
    const a = await request(app).post("/api/sessions").send({ displayName: "Mert" });
    const b = await request(app).post("/api/sessions").send({ displayName: "Mert" });
    expect(a.body.participant.id).not.toBe(b.body.participant.id);
    expect(a.body.token).not.toBe(b.body.token);
  });
  it("keeps identities after restart and stores only token hashes", async () => {
    const { app, databasePath } = fixture();
    const created = await request(app).post("/api/sessions").send({ displayName: "Ege" });
    const second = createApp({ databasePath });
    cleanup.push(() => second.locals.sessionStore.close());
    const me = await request(second)
      .get("/api/me")
      .set("Authorization", `Bearer ${created.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.participant).toEqual(created.body.participant);
    expect(readFileSync(databasePath).includes(Buffer.from(created.body.token))).toBe(
      false,
    );
    expect(
      readFileSync(databasePath + "-wal").includes(Buffer.from(created.body.token)),
    ).toBe(false);
  });
  it("revokes only the current session", async () => {
    const { app } = fixture();
    const a = await request(app).post("/api/sessions").send({ displayName: "Mert" });
    const b = await request(app).post("/api/sessions").send({ displayName: "Vesim" });
    expect(
      (
        await request(app)
          .delete("/api/sessions/current")
          .set("Authorization", `Bearer ${a.body.token}`)
      ).status,
    ).toBe(204);
    expect(
      (await request(app).get("/api/me").set("Authorization", `Bearer ${a.body.token}`))
        .status,
    ).toBe(401);
    expect(
      (await request(app).get("/api/me").set("Authorization", `Bearer ${b.body.token}`))
        .status,
    ).toBe(200);
  });
});

it("expires sessions without deleting the participant", async () => {
  const { openSessions } = await import("../src/store/sessions.js");
  const dir = mkdtempSync(join(tmpdir(), "goal-digger-expiry-"));
  let now = 1792240000000;
  const store = openSessions(join(dir, "api.sqlite"), () => now);
  try {
    const session = store.create("Vesim");
    expect(store.find(session.token)?.id).toBe(session.participant.id);
    now += 7 * 24 * 60 * 60 * 1000;
    expect(store.find(session.token)).toBeNull();
  } finally {
    store.close();
    rmSync(dir, { recursive: true });
  }
});
