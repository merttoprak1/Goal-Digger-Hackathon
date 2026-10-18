export const goalyBuilderFormat = {
  type: "json_schema",
  json_schema: {
    name: "challenge_draft_assistant",
    strict: true,
    schema: {
      type: "object",
      properties: {
        answer: { type: "string" },
        readyToCreate: { type: "boolean" },
        draft: {
          type: "object",
          properties: {
            title: { type: ["string", "null"] },
            successRule: { type: ["string", "null"] },
            proofSource: { type: ["string", "null"] },
            stake: { type: ["string", "null"] },
            deadline: { type: ["string", "null"] },
            visibility: { enum: ["public", "solo", null] },
          },
          required: ["title", "successRule", "proofSource", "stake", "deadline", "visibility"],
          additionalProperties: false,
        },
      },
      required: ["answer", "readyToCreate", "draft"],
      additionalProperties: false,
    },
  },
};

const DRAFT_FIELDS = ["deadline", "proofSource", "stake", "successRule", "title", "visibility"];

export function goalyBuilderMessages(history, currentDraft) {
  const draft = Object.fromEntries(DRAFT_FIELDS.map((field) => [field, currentDraft[field] ?? null]));
  return [
    {
      role: "system",
      content: `You are Goaly, Goal Digger's custom challenge builder. Reply in the user's language. Read the conversation and current form draft. Return only the required JSON.

Collect title, measurable successRule, proofSource, test-USDT stake, exact deadline, and public or solo visibility. Proof source is free-form: accept any non-empty description the user writes, in their own words. Do not require a URL, special format, or external verification. The app accepts written proof statements and image attachments in the formal proof form. A chat image is context only; do not claim it submits formal proof.

Use user-stated or confirmed facts only. Prefilled values are unconfirmed. Ask one concise question for the next missing item. Confirm title/rule, source, stake, future deadline, and visibility. Accept a proof description without asking for a URL or more detail. "My local time" means browser-local; do not ask its timezone.

Earlier assistant replies may be wrong. Follow these rules over earlier requests for proof URLs, formats, verification, or timezone; correct them when the user has provided a value.

Deadline format is browser-local YYYY-MM-DDTHH:mm, at least two hours in the future. Do not convert timezones; ask for an exact date and time instead of a relative time. draft.stake must be only a numeric decimal (for example, "1"), never include "USDT"; strip the currency label if the user wrote one.

Keep replies to 1-3 short sentences. Set readyToCreate=false until every required value is valid and confirmed. Then summarize all six values and ask the user to check them; set readyToCreate=true so the app can show a Create goal button in your chat as the user's final confirmation. Never say you created or published the challenge, requested or sent an invoice, approved a wallet payment, or moved funds. Pressing Create goal starts the existing challenge/deposit flow; the user must still approve the payment in KaleidoSwap.

Current form draft (prefilled values are unconfirmed): ${JSON.stringify(draft)}`,
    },
    ...history.map(({ role, content, imageDataUrl }) => ({
      role,
      content: imageDataUrl
        ? [
            { type: "text", text: content },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ]
        : content,
    })),
  ];
}

export function parseGoalyBuilderAnswer(content) {
  let value;
  try {
    value = JSON.parse(content);
  } catch {
    throw new Error("QVAC returned an invalid challenge draft.");
  }
  if (
    !value ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    Object.keys(value).sort().join(",") !== "answer,draft,readyToCreate" ||
    typeof value.answer !== "string" ||
    !value.answer.trim() ||
    typeof value.readyToCreate !== "boolean" ||
    !value.draft ||
    Array.isArray(value.draft) ||
    typeof value.draft !== "object" ||
    Object.keys(value.draft).sort().join(",") !== DRAFT_FIELDS.join(",") ||
    DRAFT_FIELDS.some((field) => {
      const fieldValue = value.draft[field];
      return field === "visibility"
        ? fieldValue !== null && fieldValue !== "public" && fieldValue !== "solo"
        : fieldValue !== null && typeof fieldValue !== "string";
    })
  ) {
    throw new Error("QVAC returned an invalid challenge draft.");
  }
  return {
    answer: value.answer.trim(),
    readyToCreate: value.readyToCreate,
    draft: value.draft,
  };
}

export function validateGoalyBuilderDraft(draft) {
  if (
    !draft ||
    Array.isArray(draft) ||
    typeof draft !== "object" ||
    Object.keys(draft).sort().join(",") !== DRAFT_FIELDS.join(",") ||
    DRAFT_FIELDS.some((field) =>
      field === "visibility"
        ? draft[field] !== null && draft[field] !== "public" && draft[field] !== "solo"
        : draft[field] !== null && (typeof draft[field] !== "string" || draft[field].length > 1000),
    )
  ) {
    throw new Error("Send valid current challenge draft fields.");
  }
  return draft;
}
