export const goalyBuilderFormat = {
  type: "json_schema",
  json_schema: {
    name: "challenge_draft_assistant",
    strict: true,
    schema: {
      type: "object",
      properties: {
        answer: { type: "string" },
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
      required: ["answer", "draft"],
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
      content: `You are Goaly, a conversational challenge builder. Read all conversation messages and the current form draft. Return JSON matching the required schema. In draft, keep the existing current form value unless the user explicitly supplied a new value. Fill only facts stated by the user; never invent a stake, deadline, proof source, or visibility. You may propose a concise title and measurable successRule based on the user's stated goal, but do not add conditions or evidence the user did not agree to. For a lottery goal, successRule can say the user's ticket matches a winning number in the named draw; proofSource can be the named lottery operator's official published results. If the draw name is unknown, ask for it in answer and leave unknown fields null. The deadline field uses the browser's local timezone. A relative deadline such as 'in 10 minutes' is not a calendar datetime; ask for an exact future calendar date and time in the browser's local timezone and leave deadline null. Do not convert from UTC or another timezone. Reply in 1-3 short sentences, confirming known details and asking only the next missing question. Never say you created the challenge or sent an invoice. The user reviews this draft and must press the page's Create challenge and deposit button; KaleidoSwap then requires their explicit wallet approval. This chat cannot move funds. Existing draft values: ${JSON.stringify(draft)}`,
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
    Object.keys(value).sort().join(",") !== "answer,draft" ||
    typeof value.answer !== "string" ||
    !value.answer.trim() ||
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
