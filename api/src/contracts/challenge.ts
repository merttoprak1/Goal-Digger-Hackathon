import { z } from "zod";
const text = (max: number) => z.string().trim().min(3).max(max);
const timestamp = z.iso
  .datetime({ offset: true })
  .refine((value) => Number.isFinite(Date.parse(value)));
export const challengeDraftSchema = z
  .object({
    template: z.enum(["wake_up", "exam", "run", "custom"]),
    title: text(120),
    successRule: text(1000),
    proofMethod: z.enum(["timed_math", "official_result", "activity_record", "custom"]),
    proofSource: text(500),
    timezone: z
      .string()
      .min(1)
      .max(80)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Use a valid timezone."),
    bettingCutoff: timestamp,
    startsAt: timestamp,
    proofDeadline: timestamp,
    creatorStakeAtomic: z
      .string()
      .regex(/^[1-9][0-9]{0,8}$/)
      .refine((value) => /^[1-9][0-9]{0,8}$/.test(value) && BigInt(value) <= 100000000n),
    visibility: z.enum(["public", "solo"]).default("public"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Date.parse(value.bettingCutoff) <= Date.now())
      ctx.addIssue({
        code: "custom",
        path: ["bettingCutoff"],
        message: "The betting cutoff must be in the future.",
      });
    if (Date.parse(value.bettingCutoff) >= Date.parse(value.startsAt))
      ctx.addIssue({
        code: "custom",
        path: ["startsAt"],
        message: "The challenge must start after betting closes.",
      });
    if (Date.parse(value.proofDeadline) <= Date.parse(value.startsAt))
      ctx.addIssue({
        code: "custom",
        path: ["proofDeadline"],
        message: "The proof deadline must follow the start.",
      });
    const methods = {
      wake_up: "timed_math",
      exam: "official_result",
      run: "activity_record",
      custom: "custom",
    };
    if (value.proofMethod !== methods[value.template])
      ctx.addIssue({
        code: "custom",
        path: ["proofMethod"],
        message: "Use the proof method for this challenge template.",
      });
  });
export type ChallengeDraftInput = z.infer<typeof challengeDraftSchema>;
