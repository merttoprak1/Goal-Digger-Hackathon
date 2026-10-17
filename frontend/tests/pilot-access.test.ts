import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertPilotCommand,
  createPilotAccessMiddleware,
  pilotAccessConfig,
} from "../app/lib/pilot-access.ts";

function request(authorization?: string) {
  const headers: Record<string, string> = {};
  if (authorization) headers.authorization = authorization;
  const responseHeaders: Record<string, string> = {};
  const response = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      responseHeaders[name.toLowerCase()] = value;
    },
    end(body: string) {
      return body;
    },
  };
  let continued = false;
  createPilotAccessMiddleware(pilotAccessConfig({
    PILOT_MODE: "true",
    PILOT_ACCESS_PASSWORD: "pilot-secret",
  }))(
    { headers } as never,
    response as never,
    () => { continued = true; },
  );
  return { continued, response, responseHeaders };
}

test("pilot mode refuses to start without a non-empty access password", () => {
  assert.throws(
    () => pilotAccessConfig({ PILOT_MODE: "true" }),
    /PILOT_ACCESS_PASSWORD/,
  );
  assert.throws(
    () => pilotAccessConfig({ PILOT_MODE: "true", PILOT_ACCESS_PASSWORD: "  " }),
    /PILOT_ACCESS_PASSWORD/,
  );
});

test("pilot mode cannot be used to build an unprotected production bundle", () => {
  assert.throws(
    () => assertPilotCommand("build", pilotAccessConfig({
      PILOT_MODE: "true",
      PILOT_ACCESS_PASSWORD: "pilot-secret",
    })),
    /upstream access control/,
  );
  assert.doesNotThrow(() => assertPilotCommand("build", pilotAccessConfig({})));
});

test("pilot middleware challenges requests without valid Basic credentials", () => {
  for (const result of [request(), request(`Basic ${Buffer.from("pilot:wrong").toString("base64")}`)]) {
    assert.equal(result.continued, false);
    assert.equal(result.response.statusCode, 401);
    assert.match(result.responseHeaders["www-authenticate"], /^Basic realm=/);
  }
});

test("pilot middleware allows the configured pilot account", () => {
  const credentials = Buffer.from("pilot:pilot-secret").toString("base64");
  const result = request(`Basic ${credentials}`);
  assert.equal(result.continued, true);
  assert.equal(result.response.statusCode, 200);
});

test("local development remains available when pilot mode is disabled", () => {
  const middleware = createPilotAccessMiddleware(pilotAccessConfig({ PILOT_MODE: "false" }));
  let continued = false;
  middleware(
    { headers: {} } as never,
    { statusCode: 200, setHeader() {}, end() {} } as never,
    () => { continued = true; },
  );
  assert.equal(continued, true);
});
