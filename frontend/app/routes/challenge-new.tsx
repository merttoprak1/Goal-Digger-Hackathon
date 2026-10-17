import type { Route } from "./+types/challenge-new";
import { ComingSoon } from "~/components/coming-soon";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Create Challenge · Goal Digger" }];
}

export default function CreateChallenge() {
  return (
    <ComingSoon
      title="Create Challenge"
      description="The four-step composer from the design: choose an archetype, set the rules and deadlines, declare the proof source for QVAC, then stake USDT on RGB."
      planned={[
        "Step indicator: Template → Rules & Deadlines → Proof & QVAC AI → Stake on RGB",
        "Archetype cards: Wake Up on Time, Pass an Exam, Complete a Run, Custom",
        "Challenge title, success criterion, betting cutoff, proof deadline",
        "QVAC arbiter prompt manifest with read-only config and SHA-256",
        "Sticky Stake & Settle rail with opponent pool cap and draft saving",
      ]}
    />
  );
}
