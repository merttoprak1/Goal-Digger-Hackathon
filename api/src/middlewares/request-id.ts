import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare module "express-serve-static-core" {
  interface Request {
    requestId: string;
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const header = req.header("x-request-id");
  req.requestId = header && header.length <= 64 ? header : randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}
