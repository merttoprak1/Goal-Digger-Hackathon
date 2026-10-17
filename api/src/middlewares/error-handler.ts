import type { NextFunction, Request, Response } from "express";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code ?? "API_ERROR", message: err.message },
    });
    return;
  }

  // Malformed JSON body from express.json()
  if (
    err instanceof SyntaxError &&
    "status" in err &&
    (err as { status?: unknown }).status === 400
  ) {
    res.status(400).json({
      error: { code: "INVALID_JSON", message: "Malformed JSON body" },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL", message: "Internal server error" },
  });
}
