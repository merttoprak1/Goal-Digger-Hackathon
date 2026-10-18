export type GoalyMessage = { role: "user" | "assistant"; content: string };
export type GoalyDraft = {
  title: string;
  successRule: string;
  proofSource: string;
  stake: string;
  deadline: string;
  visibility: "public" | "solo";
};
export type GoalyReply = { answer: string; draft?: GoalyDraft };

export async function askGoaly(
  messages: GoalyMessage[],
  draft?: GoalyDraft,
): Promise<GoalyReply> {
  const conversation = messages.slice(-6);
  const latest = conversation.at(-1)?.content;
  if (!latest?.trim() || latest.length > 500)
    throw Error("Use 1 to 500 characters for your challenge.");
  const response = await fetch(draft ? "/qvac/builder" : "/qvac/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft ? {
      messages: conversation.map(({ role, content }) => ({
        role,
        content: content.slice(0, 250),
      })),
      draft,
    } : {
      messages: conversation.map(({ role, content }) => ({
        role,
        content: content.slice(0, 250),
      })),
    }),
    signal: AbortSignal.timeout(35000),
  });
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw Error(
      `Goaly received an invalid response (HTTP ${response.status}). Check that the local QVAC service runs on port 4000.`,
    );
  }
  if (!response.ok)
    throw Error(
      typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
        ? result.error
        : "Goaly is unavailable. Try again.",
    );
  if (
    typeof result !== "object" ||
    result === null ||
    !("answer" in result) ||
    typeof result.answer !== "string" ||
    !result.answer.trim()
  )
    throw Error("Goaly returned no usable reply.");
  const answer = result.answer;
  if (draft) {
    const returnedDraft = "draft" in result ? result.draft : null;
    const returnedDraftObject =
      typeof returnedDraft === "object" && returnedDraft !== null
        ? (returnedDraft as Record<string, unknown>)
        : null;
    if (
      !returnedDraftObject ||
      !["title", "successRule", "proofSource", "stake", "deadline"].every(
        (field) => field in returnedDraftObject && (returnedDraftObject[field] === null || typeof returnedDraftObject[field] === "string"),
      ) ||
      !("visibility" in returnedDraftObject) ||
      (returnedDraftObject.visibility !== null && returnedDraftObject.visibility !== "public" && returnedDraftObject.visibility !== "solo")
    ) {
      throw Error("Goaly returned an invalid challenge draft.");
    }
    const parsedDraft = returnedDraftObject as Record<string, string | null>;
    return {
      answer,
      draft: {
        title: parsedDraft.title ?? draft.title,
        successRule: parsedDraft.successRule ?? draft.successRule,
        proofSource: parsedDraft.proofSource ?? draft.proofSource,
        stake: parsedDraft.stake ?? draft.stake,
        deadline: parsedDraft.deadline ?? draft.deadline,
        visibility: parsedDraft.visibility === "solo" || parsedDraft.visibility === "public"
          ? parsedDraft.visibility
          : draft.visibility,
      },
    };
  }
  return { answer };
}
