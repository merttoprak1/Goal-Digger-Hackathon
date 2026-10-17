import type { SessionStore } from "./context.js";

interface ChallengeRecord {
  id: string;
  creatorId: string;
  bettingCutoff: string;
  startsAt: string;
  creatorStakeAtomic: string;
}

export function projectChallenge<T extends ChallengeRecord>(
  store: SessionStore,
  challenge: T,
) {
  const credits = store.listStakeCredits(challenge.id);
  const creatorCredit = credits.find(
    (credit) =>
      credit.participantId === challenge.creatorId &&
      credit.paymentId === `creator-${challenge.id}`,
  );
  const publishedAt = store.publication(challenge.id);
  const timelyCredits = credits.filter(
    (credit) => Date.parse(credit.creditedAt) < Date.parse(challenge.bettingCutoff),
  );
  const reviewRequired = timelyCredits.length !== credits.length;
  const funded =
    creatorCredit &&
    Date.parse(creatorCredit.creditedAt) < Date.parse(challenge.bettingCutoff);
  const bettingOpen = Date.now() < Date.parse(challenge.bettingCutoff);
  const outcome = store.getOutcome(challenge.id);

  let status = "draft";
  if (reviewRequired) status = "funding_review";
  else if (outcome) status = outcome.status === "success" ? "succeeded" : "failed";
  else if (publishedAt) status = bettingOpen ? "open" : "betting_closed";
  else if (funded) status = "funded";

  return {
    ...challenge,
    publishedAt,
    reviewRequired,
    outcome,
    creatorDisplayName: store.nameOf(challenge.creatorId),
    confirmedPoolAtomic: sumAtomic(credits),
    eligiblePoolAtomic: sumAtomic(timelyCredits),
    status,
  };
}

function sumAtomic(credits: Array<{ amountAtomic: string }>): string {
  return credits.reduce((total, credit) => total + BigInt(credit.amountAtomic), 0n).toString();
}
