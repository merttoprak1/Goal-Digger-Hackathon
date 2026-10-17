import type { Route } from "./+types/ledger";
import { ComingSoon } from "~/components/coming-soon";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Pool Ledger · Goal Digger" }];
}

export default function Ledger() {
  return (
    <ComingSoon
      title="Pool Ledger"
      description="A full audit view of every escrow: creator stakes, opponent pools, RGB state transitions, and payout settlement."
      planned={[
        "Per-challenge escrow breakdown with confirmed stakes",
        "Proportional payout preview with exact asset precision",
        "RGB transfer identifiers and confirmation status",
        "Filters by state: pending, confirmed, failed",
      ]}
    />
  );
}
