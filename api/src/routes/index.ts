import { Router } from "express";
import { createHealthRouter, type ReadinessChecks } from "./health.js";

export function createRoutes(checks: ReadinessChecks) {
  const routes = Router();
  routes.use("/health", createHealthRouter(checks));
  return routes;
}
