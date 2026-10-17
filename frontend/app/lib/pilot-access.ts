import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface PilotAccessConfig {
  enabled: boolean;
  password: string;
}

export function pilotAccessConfig(
  env: Record<string, string | undefined>,
): PilotAccessConfig {
  const mode = env.PILOT_MODE;
  if (mode && mode !== "true" && mode !== "false") {
    throw new Error('PILOT_MODE must be "true" or "false".');
  }
  const enabled = mode === "true";
  const password = env.PILOT_ACCESS_PASSWORD ?? "";
  if (enabled && !password.trim()) {
    throw new Error("PILOT_ACCESS_PASSWORD is required when PILOT_MODE=true.");
  }
  return { enabled, password };
}

export function assertPilotCommand(command: "serve" | "build", config: PilotAccessConfig) {
  if (command === "build" && config.enabled) {
    throw new Error(
      "PILOT_MODE protects the Vite development server only. Use upstream access control for production builds.",
    );
  }
}

export function createPilotAccessMiddleware(config: PilotAccessConfig) {
  const expectedPassword = createHash("sha256").update(config.password).digest();

  return (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
  ): void => {
    if (!config.enabled) {
      next();
      return;
    }

    const authorization = request.headers.authorization;
    const match = typeof authorization === "string"
      ? /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(authorization)
      : null;
    const decoded = match ? Buffer.from(match[1], "base64").toString("utf8") : "";
    const separator = decoded.indexOf(":");
    const username = separator >= 0 ? decoded.slice(0, separator) : "";
    const password = separator >= 0 ? decoded.slice(separator + 1) : "";
    const suppliedPassword = createHash("sha256").update(password).digest();
    const passwordMatches = timingSafeEqual(expectedPassword, suppliedPassword);

    if (username === "pilot" && passwordMatches) {
      next();
      return;
    }

    response.statusCode = 401;
    response.setHeader(
      "WWW-Authenticate",
      'Basic realm="Goal Digger Mutinynet pilot", charset="UTF-8"',
    );
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.end("Pilot access required.");
  };
}
