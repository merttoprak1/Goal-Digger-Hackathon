import { Router } from "express";
import { healthRouter } from "./health.js";

export const routes = Router();

routes.use("/health", healthRouter);
