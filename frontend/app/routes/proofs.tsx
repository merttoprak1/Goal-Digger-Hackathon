import type { Route } from "./+types/proofs";
import { ComingSoon } from "~/components/coming-soon";

export function meta({}: Route.MetaArgs) {
  return [{ title: "My Proofs · Goal Digger" }];
}

export default function Proofs() {
  return (
    <ComingSoon
      title="My Proofs"
      description="Evidence submission and the QVAC verification console: upload proof, watch the model evaluate it, and follow the RGB settlement that follows."
      planned={[
        "Countdown header for the active epoch",
        "Submitted evidence stream with camera origin and SHA-256",
        "QVAC 2B inference checks with confidence per criterion",
        "Synthesized verdict with audio playback",
        "RGB smart contract trigger and state transition history",
      ]}
    />
  );
}
