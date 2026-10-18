export type GoalyMessage = { role: "user" | "assistant"; content: string; imageDataUrl?: string };
export type GoalyDraft = {
  title: string;
  successRule: string;
  proofSource: string;
  stake: string;
  deadline: string;
  visibility: "public" | "solo";
};
export type GoalyReply = { answer: string; draft?: GoalyDraft; readyToCreate?: boolean };

export function createGoalyFinalConfirmation(draft: GoalyDraft): string {
  const lines = [
    "Review the challenge details:",
    `Title: ${draft.title}`,
    `Success rule: ${draft.successRule}`,
    `Proof: ${draft.proofSource}`,
    `Stake: ${draft.stake} USDT`,
    `Deadline: ${draft.deadline} (your browser's local time)`,
    `Visibility: ${draft.visibility === "public" ? "Public" : "Solo"}`,
    "If everything is correct, select Create goal below. KaleidoSwap will ask you to approve the deposit.",
  ];
  if (/\b(?:photo|picture|image|screenshot|attachment|file)\b/i.test(draft.proofSource)) {
    lines.splice(6, 0, "Attach your photo with the proof submission on the challenge page before the deadline.");
  }
  return lines.join("\n");
}

function readProofSourceReply(messages: GoalyMessage[]): string | null {
  const lastUserFromEnd = [...messages].reverse().findIndex(({ role }) => role === "user");
  if (lastUserFromEnd < 0) return null;
  const lastUserIndex = messages.length - 1 - lastUserFromEnd;
  const latest = messages[lastUserIndex].content.trim();
  const labeled = latest.match(/(?:^|\b)proof(?: source)?\s*[:=-]\s*(.+)$/is);
  if (labeled?.[1]?.trim()) return labeled[1].trim();

  const previousAssistant = messages
    .slice(0, lastUserIndex)
    .reverse()
    .find(({ role }) => role === "assistant")?.content ?? "";
  const assistantAskedForProof = /\b(?:proof|evidence|source|URL)\b/i.test(previousAssistant);
  const looksLikeDeadlineAnswer = /\b(?:time ?zone|local time|UTC|GMT|deadline)\b/i.test(latest);
  return assistantAskedForProof && !looksLikeDeadlineAnswer && latest ? latest : null;
}

export function sanitizeGoalyBuilderReply(answer: string, draft: GoalyDraft): string {
  if (
    /\b(?:i|we)\s+(?:have\s+)?(?:created|published)\b|\bchallenge\s+(?:was\s+|has been\s+)?(?:created|published)\b|\b(?:created|published)\s+successfully\b/i.test(answer)
  ) {
    return "The challenge has not been created. Review the draft in the form and reply with any corrections. The Create goal button appears once Goaly marks it ready; payment still requires your approval in KaleidoSwap.";
  }

  const normalizedDeadline = draft.deadline.replace(" ", "T");
  const dateTimePattern = /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}\b/g;
  const mentionedDateTimes = answer.match(dateTimePattern) ?? [];
  if (mentionedDateTimes.some((value) => value.replace(" ", "T") !== normalizedDeadline)) {
    return `The deadline in the form is exactly ${draft.deadline} in your browser's local time. Review or correct this value before confirming the challenge.`;
  }

  const mentionedDates = answer.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  if (mentionedDates.some((value) => value !== normalizedDeadline.slice(0, 10))) {
    return `The deadline in the form is exactly ${draft.deadline} in your browser's local time. Review or correct this value before confirming the challenge.`;
  }

  const answerWithoutDateTimes = answer.replace(dateTimePattern, "");
  const mentionedTimes = answerWithoutDateTimes.match(/\b\d{1,2}:\d{2}\b/g) ?? [];
  const expectedTime = normalizedDeadline.slice(11, 16);
  if (mentionedTimes.some((value) => value.padStart(5, "0") !== expectedTime)) {
    return `The deadline in the form is exactly ${draft.deadline} in your browser's local time. Review or correct this value before confirming the challenge.`;
  }
  return answer;
}

export function isGoalyDraftReadyToCreate(
  readyToCreate: boolean,
  proposedDraft: GoalyDraft,
  currentDraft: GoalyDraft,
  now = Date.now(),
): boolean {
  if (!readyToCreate) return false;
  const fields: Array<keyof GoalyDraft> = [
    "title", "successRule", "proofSource", "stake", "deadline", "visibility",
  ];
  if (fields.some((field) => proposedDraft[field] !== currentDraft[field])) return false;
  const title = proposedDraft.title.trim();
  const successRule = proposedDraft.successRule.trim();
  const proofSource = proposedDraft.proofSource.trim();
  const stake = proposedDraft.stake.trim();
  const stakeMatch = /^(?:0|[1-9]\d{0,2})(?:\.(\d{1,6}))?$/.exec(stake);
  const stakeAtomic = stakeMatch
    ? BigInt(stake.split(".")[0]) * 1_000_000n +
      BigInt((stake.split(".")[1] ?? "").padEnd(6, "0"))
    : 0n;
  const deadline = Date.parse(proposedDraft.deadline);
  return title.length >= 3 && title.length <= 120 &&
    successRule.length >= 3 && proofSource.length >= 3 && proofSource.length <= 500 &&
    stakeAtomic >= 1n && stakeAtomic <= 100_000_000n &&
    Number.isFinite(deadline) && deadline >= now + 7_200_000;
}

export async function askGoaly(
  messages: GoalyMessage[],
  draft?: GoalyDraft,
): Promise<GoalyReply> {
  const conversation = messages.slice(-6);
  const latest = conversation.at(-1)?.content;
  const latestMessage = conversation.at(-1);
  if ((!latest?.trim() && !latestMessage?.imageDataUrl) || (latest?.length ?? 0) > 500)
    throw Error("Use 1 to 500 characters for your challenge.");
  const requestMessages = conversation.map(({ role, content }, index) => ({
    role,
    content: content.slice(0, 250) || (index === conversation.length - 1 && latestMessage?.imageDataUrl ? "Please review this image as context." : ""),
    ...(index === conversation.length - 1 && latestMessage?.role === "user" && latestMessage.imageDataUrl
      ? { imageDataUrl: latestMessage.imageDataUrl }
      : {}),
  }));
  const hasImage = requestMessages.some((message) => "imageDataUrl" in message);
  const response = await fetch(draft ? "/qvac/builder" : "/qvac/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft ? {
      messages: requestMessages,
      draft,
    } : {
      messages: requestMessages,
    }),
    signal: AbortSignal.timeout(hasImage ? 65000 : 35000),
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
  let answer = result.answer;
  if (draft) {
    // Older QVAC processes may omit this field. Keep their chat response usable,
    // but never expose the create action without an explicit readiness signal.
    let readyToCreate =
      "readyToCreate" in result && result.readyToCreate === true;
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
    const returnedStake = parsedDraft.stake ?? draft.stake;
    let resolvedDraft: GoalyDraft = {
        title: parsedDraft.title ?? draft.title,
        successRule: parsedDraft.successRule ?? draft.successRule,
        proofSource: parsedDraft.proofSource ?? draft.proofSource,
        stake: returnedStake.replace(/\s*USDT\s*$/i, "").trim(),
        deadline: parsedDraft.deadline ?? draft.deadline,
        visibility: parsedDraft.visibility === "solo" || parsedDraft.visibility === "public"
          ? parsedDraft.visibility
          : draft.visibility,
    };
    const proofSourceReply = readProofSourceReply(conversation);
    if (proofSourceReply) {
      resolvedDraft = { ...draft, proofSource: proofSourceReply };
      readyToCreate = isGoalyDraftReadyToCreate(
        true,
        resolvedDraft,
        { ...draft, proofSource: proofSourceReply },
      );
      answer = readyToCreate
        ? "Your proof source is recorded as written. No URL or special format is required. Review the completed challenge details below."
        : "Your proof source is recorded as written. No URL or special format is required. Complete any remaining challenge details in the form or chat.";
      if (/\b(?:photo|picture|image|screenshot|attachment|file)\b/i.test(proofSourceReply)) {
        answer += " You can attach a photo with your proof submission on the challenge page.";
      }
    }
    return {
      answer: sanitizeGoalyBuilderReply(answer, resolvedDraft),
      readyToCreate,
      draft: resolvedDraft,
    };
  }
  return { answer };
}
