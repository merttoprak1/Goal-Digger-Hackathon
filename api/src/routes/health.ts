import { Router } from "express";

export interface ReadinessChecks {
  database: () => boolean | Promise<boolean>;
  vault: () => boolean | Promise<boolean>;
  qvacRgb: () => Promise<{ qvac: boolean; rgb: boolean }>;
}

type ComponentStatus = "ok" | "unavailable";

export function createHealthRouter(checks: ReadinessChecks) {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ status: "ok" });
  });

  router.get("/ready", async (_req, res) => {
    const statusFor = async (check: () => boolean | Promise<boolean>): Promise<ComponentStatus> => {
      try {
        return (await check()) === true ? "ok" : "unavailable";
      } catch {
        return "unavailable";
      }
    };
    const [database, vault] = await Promise.all([
      statusFor(checks.database),
      statusFor(checks.vault),
    ]);
    let qvac = "unavailable" as ComponentStatus;
    let rgb = "unavailable" as ComponentStatus;
    try {
      const result = await checks.qvacRgb();
      qvac = result.qvac === true ? "ok" : "unavailable";
      rgb = result.rgb === true ? "ok" : "unavailable";
    } catch {
      // Never include dependency errors because they may contain local details or credentials.
    }
    const components = { database, vault, qvac, rgb };
    const ready = Object.values(components).every((status) => status === "ok");
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "unavailable",
      checks: components,
    });
  });

  return router;
}
