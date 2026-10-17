const base = "http://127.0.0.1:11434";

try {
  const response = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: "goal-digger",
      messages: [{ role: "user", content: "What is 2 + 2? Reply with only the number." }],
      temperature: 0,
      max_tokens: 32,
      reasoning_budget: false,
    }),
  });
  if (!response.ok) throw new Error(`QVAC returned HTTP ${response.status}.`);
  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("QVAC returned no answer.");
  console.log(`Local QVAC response: ${answer}`);
  if (answer !== "4") throw new Error("The model did not return the expected answer: 4.");
  console.log("QVAC check passed.");
} catch (error) {
  console.error(error.message);
  console.error("Start QVAC first: qvac serve --openai --config qvac.config.mjs");
  process.exitCode = 1;
}
