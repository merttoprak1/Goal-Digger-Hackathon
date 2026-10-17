import { createServer } from "node:http";
import { goalyMessages } from "./goaly.mjs";
import {
  goalyBuilderFormat,
  goalyBuilderMessages,
  parseGoalyBuilderAnswer,
  validateGoalyBuilderDraft,
} from "./goaly-builder.mjs";
import {
  assessmentFormat,
  assessmentMessages,
  assessmentRule,
  assessAnswer,
  proofReviewFormat,
  proofReviewMessages,
  assessProof,
  parseProofReviewRequest,
  proofReviewBodyLimit,
} from "./assessment.mjs";
import { getRgbWallet } from "./rgb-wallet.mjs";

export async function getHealth(fetchService = fetch) {
  async function check(url, validate) {
    try {
      const response = await fetchService(url, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) return { status: "unavailable", httpStatus: response.status };
      const body = await response.json();
      return validate(body) ? { status: "ok" } : { status: "unexpected_response" };
    } catch {
      return { status: "unavailable" };
    }
  }

  const [qvac, rgb] = await Promise.all([
    check(
      "http://127.0.0.1:11434/v1/models",
      (body) =>
        Array.isArray(body?.data) &&
        body.data.some((model) => model?.id === "goal-digger"),
    ),
    check(
      "http://127.0.0.1:3001/nodeinfo",
      (body) => typeof body?.pubkey === "string" && body.pubkey.length > 0,
    ),
  ]);
  return {
    status: qvac.status === "ok" && rgb.status === "ok" ? "ok" : "degraded",
    qvac,
    rgb,
  };
}

function requestError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function readText(request, field) {
  if (
    request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    throw requestError(415, "Send Content-Type: application/json.");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 4096) {
      request.resume();
      throw requestError(413, "The request body must not exceed 4 KB.");
    }
    chunks.push(chunk);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw requestError(400, "Send valid JSON.");
  }
  if (
    !body ||
    Array.isArray(body) ||
    typeof body !== "object" ||
    Object.keys(body).length !== 1 ||
    typeof body[field] !== "string" ||
    body[field].trim().length === 0 ||
    body[field].length > 500
  ) {
    throw requestError(400, `Send only ${field} containing 1 to 500 characters.`);
  }
  return body[field].trim();
}

async function readGoalyHistory(request, { builder = false } = {}) {
  if (
    request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    throw requestError(415, "Send Content-Type: application/json.");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 4096) {
      request.resume();
      throw requestError(413, "The request body must not exceed 4 KB.");
    }
    chunks.push(chunk);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw requestError(400, "Send valid JSON.");
  }
  const messages = body?.messages;
  if (
    !body ||
    Array.isArray(body) ||
    typeof body !== "object" ||
    Object.keys(body).sort().join(",") !== (builder ? "draft,messages" : "messages") ||
    !Array.isArray(messages) ||
    messages.length < 1 ||
    messages.length > 12 ||
    messages.some(
      (message) =>
        !message ||
        Array.isArray(message) ||
        typeof message !== "object" ||
        Object.keys(message).sort().join(",") !== "content,role" ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" ||
        !message.content.trim() ||
        message.content.length > 500,
    ) ||
    messages.at(-1)?.role !== "user"
  ) {
    throw requestError(400, "Send 1 to 12 valid chat messages ending with a user message.");
  }
  const history = messages.map(({ role, content }) => ({ role, content: content.trim() }));
  if (!builder) return history;
  try {
    validateGoalyBuilderDraft(body.draft);
  } catch (error) {
    throw requestError(400, error.message);
  }
  return { history, draft: body.draft };
}

async function readAssessment(request) {
  if (
    request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    throw requestError(415, "Send Content-Type: application/json.");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 4096) {
      request.resume();
      throw requestError(413, "The request body must not exceed 4 KB.");
    }
    chunks.push(chunk);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw requestError(400, "Send valid JSON.");
  }
  if (!body || Array.isArray(body) || typeof body !== "object")
    throw requestError(400, "Send valid evidence assessment fields.");

  const keys = Object.keys(body).sort().join(",");
  if (keys === "evidence") {
    if (typeof body.evidence !== "string" || !body.evidence.trim() || body.evidence.length > 500)
      throw requestError(400, "Send evidence containing 1 to 500 characters.");
    return { evidence: body.evidence.trim(), rule: assessmentRule, expectedAnswer: 25 };
  }
  if (
    keys !== "evidence,expectedAnswer,question" ||
    typeof body.evidence !== "string" ||
    !body.evidence.trim() ||
    body.evidence.length > 500 ||
    typeof body.question !== "string" ||
    !body.question.trim() ||
    body.question.length > 200 ||
    !Number.isSafeInteger(body.expectedAnswer) ||
    Math.abs(body.expectedAnswer) > 999999
  ) {
    throw requestError(400, "Send evidence, question, and a bounded integer expectedAnswer.");
  }
  return {
    evidence: body.evidence.trim(),
    rule: { id: "challenge-timed-math-v1", question: body.question.trim() },
    expectedAnswer: body.expectedAnswer,
  };
}

async function readProofReview(request) {
  if (
    request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    throw requestError(415, "Send Content-Type: application/json.");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > proofReviewBodyLimit) {
      request.resume();
      throw requestError(413, "The proof-review request body must not exceed 16 KB.");
    }
    chunks.push(chunk);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw requestError(400, "Send valid JSON.");
  }
  try {
    return parseProofReviewRequest(body);
  } catch (error) {
    throw requestError(400, error.message);
  }
}

export async function askQvac(messages, responseFormat, fetchService = fetch) {
  let upstream;
  try {
    upstream = await fetchService("http://127.0.0.1:11434/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: "goal-digger",
        messages,
        max_tokens: 256,
        temperature: 0,
        reasoning_budget: false,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
    });
    if (!upstream.ok) throw requestError(502, `QVAC returned HTTP ${upstream.status}.`);
    const body = await upstream.json();
    const answer = body.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim())
      throw requestError(502, "QVAC returned no usable answer.");
    return { answer: answer.trim(), model: "goal-digger" };
  } catch (error) {
    if (error.status) throw error;
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw requestError(504, "QVAC did not answer within 30 seconds.");
    }
    if (upstream?.ok) throw requestError(502, "QVAC returned an invalid response.");
    throw requestError(503, "QVAC is unavailable. Start the local model server.");
  }
}

export const server = createServer(
  { requestTimeout: 10_000 },
  async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    const path = request.url?.split("?")[0];
    if (path === "/rgb/wallet") {
      if (request.method !== "GET") {
        response.setHeader("Allow", "GET");
        response
          .writeHead(405)
          .end(JSON.stringify({ error: "Use GET for this endpoint." }));
        return;
      }
      try {
        const wallet = await getRgbWallet();
        response.writeHead(200).end(JSON.stringify(wallet));
      } catch (error) {
        response.writeHead(error.status || 500).end(
          JSON.stringify({
            error: error.status ? error.message : "The wallet request failed. Try again.",
          }),
        );
      }
      return;
    }
    if (path === "/qvac/ask" || path === "/qvac/assess" || path === "/qvac/review" || path === "/qvac/chat" || path === "/qvac/builder") {
      if (request.method !== "POST") {
        response.setHeader("Allow", "POST");
        response
          .writeHead(405)
          .end(JSON.stringify({ error: "Use POST for this endpoint." }));
        return;
      }
      try {
        let result;
        if (path === "/qvac/assess") {
          const { evidence, rule, expectedAnswer } = await readAssessment(request);
          const completion = await askQvac(
            assessmentMessages(evidence, rule.question),
            assessmentFormat,
          );
          try {
            result = assessAnswer(completion.answer, evidence, {
              ...rule,
              expectedAnswer,
            });
          } catch {
            throw requestError(502, "QVAC returned an invalid assessment.");
          }
        } else if (path === "/qvac/review") {
          const review = await readProofReview(request);
          const completion = await askQvac(
            proofReviewMessages(review),
            proofReviewFormat,
          );
          try {
            result = assessProof(completion.answer, review);
          } catch {
            throw requestError(502, "QVAC returned an invalid proof assessment.");
          }
        } else {
          if (path === "/qvac/chat") {
            result = await askQvac(goalyMessages(await readGoalyHistory(request)));
          } else if (path === "/qvac/builder") {
            const { history, draft } = await readGoalyHistory(request, { builder: true });
            const completion = await askQvac(
              goalyBuilderMessages(history, draft),
              goalyBuilderFormat,
            );
            try {
              result = parseGoalyBuilderAnswer(completion.answer);
            } catch {
              throw requestError(502, "QVAC returned an invalid challenge draft.");
            }
          } else {
            const prompt = await readText(request, "prompt");
            result = await askQvac([{ role: "user", content: prompt }]);
          }
        }
        response.writeHead(200).end(JSON.stringify(result));
      } catch (error) {
        response.writeHead(error.status || 500).end(
          JSON.stringify({
            error: error.status ? error.message : "The request failed. Try again.",
          }),
        );
      }
      return;
    }
    if (path !== "/health") {
      response.writeHead(404).end(JSON.stringify({ error: "Endpoint not found." }));
      return;
    }
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      response
        .writeHead(405)
        .end(JSON.stringify({ error: "Use GET for this endpoint." }));
      return;
    }
    const health = await getHealth();
    response.writeHead(health.status === "ok" ? 200 : 503).end(JSON.stringify(health));
  },
);

if (import.meta.main) {
  server.listen(4000, "127.0.0.1", () => {
    console.log("Health endpoint: http://127.0.0.1:4000/health");
  });
  server.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
