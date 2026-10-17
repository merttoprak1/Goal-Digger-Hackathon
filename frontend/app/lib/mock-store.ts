import type {
  ArbiterProfile,
  Challenge,
  ChallengesSnapshot,
  ChallengeTemplate,
  CreateChallengeRequest,
  ProfileArbiter,
  ProfileSnapshot,
  ProfileStake,
  ProfileStat,
  ProtocolStatus,
  UserProfile,
  WalletBalance,
} from "./contracts";

/**
 * In-memory mock backend. Lives for the lifetime of the tab — enough to design
 * and demo the UI before the Express API and the RGB/QVAC integrations exist.
 *
 * Delete this file (and the mock branches in `api.ts`) once the real API lands.
 */

export const PROTOCOL_STATUS: ProtocolStatus = {
  blockHeight: "428,912",
  rgbStatus: "RGB + QVAC Protocol v1.4",
  team: "Team Bounty Hunters • RGB + QVAC on Bitcoin • Supervised by Autonomous Arbiter",
  links: [
    { label: "Rules", href: "#" },
    { label: "GitHub", href: "#" },
    { label: "Discord", href: "#" },
  ],
};

export const ARBITER: ArbiterProfile = {
  name: "Goaly",
  role: "Chief Arbiter",
  agent: "QVAC Agent",
  level: "Lv. 9",
  accuracy: "98% Accuracy",
  statusText: "Goaly is supervising the chain...",
  greeting: [
    "Yo! Ready to put your USDT where your mouth is? Name your challenge and stake, or pick a preset below. No slackers allowed on Mutinynet!",
    "Hey! Stop poking the Arbiter and go finish your challenges!",
    "Microphone & Oracle feed calibrated. All systems active!",
  ],
  replyQuotes: [
    "Contract terms noted! Locking your timelock on Mutinynet. Don't disappoint the arbiter!",
    "I will be personally validating the oracle feed. If you fail, the counterparty takes the pool!",
    "DLC terms registered on Bitcoin testnet. You've got the guts, now bring the proof!",
    "Stake accepted. The blockchain never lies, and neither do I. Get to work!",
    "Target locked in my crosshairs. Submit your cryptographic proof before the deadline!",
  ],
};

/** Mascot click / audio-toggle lines, matching the source design's behaviour. */
export const ARBITER_POKE_LINE =
  "Hey! Stop poking the Arbiter and go finish your challenges!";
export const ARBITER_CALIBRATION_LINE =
  "Microphone & Oracle feed calibrated. All systems active!";

const TEMPLATE_LABELS: Record<
  ChallengeTemplate,
  { label: string; emoji: string }
> = {
  run: { label: "Run", emoji: "🏃" },
  exam: { label: "Exam", emoji: "🎓" },
  wake_up: { label: "Wake Up", emoji: "⏰" },
  leetcode: { label: "LeetCode", emoji: "💻" },
  custom: { label: "Custom", emoji: "✨" },
};

function seed(): Challenge[] {
  return [
    {
      id: "run-10km",
      title: "Run 10 km before 09:00",
      creator: "Vesim",
      status: "active",
      template: TEMPLATE_LABELS.run.label,
      templateEmoji: TEMPLATE_LABELS.run.emoji,
      stakeUsdt: "2.5",
      poolUsdt: "7.5",
      proofSource: "Proof: Strava GPS sync",
      action: { kind: "button", label: "Bet Against", tone: "indigo" },
      proofDeadline: "2026-10-18T09:00:00+00:00",
      createdAt: "2026-10-16T06:12:00.000Z",
    },
    {
      id: "ds-exam",
      title: "Pass the distributed systems exam",
      creator: "Ege",
      status: "draft",
      template: TEMPLATE_LABELS.exam.label,
      templateEmoji: TEMPLATE_LABELS.exam.emoji,
      stakeUsdt: "10",
      poolUsdt: null,
      proofSource: "Exam transcript upload",
      action: {
        kind: "info",
        label: "⏳ Arbiter Review",
        note: "Awaiting Stake",
      },
      proofDeadline: "2026-10-24T09:00:00+00:00",
      createdAt: "2026-10-16T08:45:00.000Z",
    },
    {
      id: "wake-up-0700",
      title: "I will wake up at 07:00",
      creator: "Mert",
      status: "open",
      template: TEMPLATE_LABELS.wake_up.label,
      templateEmoji: TEMPLATE_LABELS.wake_up.emoji,
      stakeUsdt: "5",
      poolUsdt: "20",
      proofSource: "SleepCycle + Photo",
      action: { kind: "button", label: "Join Pool", tone: "indigo" },
      proofDeadline: "2026-10-26T06:30:00+00:00",
      createdAt: "2026-10-16T10:02:00.000Z",
    },
    {
      id: "leetcode-3hard",
      title: "Solve 3 Hard Problems",
      creator: "SatoshiFan",
      status: "new",
      template: TEMPLATE_LABELS.leetcode.label,
      templateEmoji: TEMPLATE_LABELS.leetcode.emoji,
      stakeUsdt: "15",
      poolUsdt: "30",
      proofSource: "LeetCode API Webhook",
      action: { kind: "button", label: "Challenge", tone: "indigo" },
      proofDeadline: "2026-11-02T23:59:00+00:00",
      createdAt: "2026-10-17T07:20:00.000Z",
    },
  ];
}

let challenges: Challenge[] = seed();

/** Ordered by proof deadline, which is what the "Sorted by" label promises. */
export function listChallenges(): Challenge[] {
  return [...challenges].sort((a, b) =>
    a.proofDeadline.localeCompare(b.proofDeadline),
  );
}

export function getChallenge(id: string): Challenge | undefined {
  return challenges.find((challenge) => challenge.id === id);
}

export function getChallengesSnapshot(): ChallengesSnapshot {
  return {
    challenges: listChallenges(),
    arbiter: ARBITER,
    protocol: PROTOCOL_STATUS,
  };
}

export function insertChallenge(
  request: CreateChallengeRequest,
  now: Date = new Date(),
): Challenge {
  const template = TEMPLATE_LABELS[request.template];
  const challenge: Challenge = {
    id: crypto.randomUUID(),
    title: request.title,
    creator: request.creator,
    status: "draft",
    template: template.label,
    templateEmoji: template.emoji,
    stakeUsdt: request.stakeUsdt,
    poolUsdt: null,
    proofSource: request.proofSource,
    action: {
      kind: "info",
      label: "⏳ Arbiter Review",
      note: "Awaiting Stake",
    },
    proofDeadline: request.proofDeadline,
    createdAt: now.toISOString(),
  };
  challenges = [challenge, ...challenges];
  return challenge;
}

/** Useful while designing: reset the mocks from the browser console. */
export function resetChallenges(): void {
  challenges = seed();
}

/* --------------------------------- profile -------------------------------- */

const USER: UserProfile = {
  name: "Mert Toprak",
  handle: "@mert_toprak",
  level: "LVL 12",
  // Testnet (Mutinynet) address from the design. Never a real wallet.
  walletAddress: "bcrt1q9vx7c4m3n8pz2rw6tyq5sh9jvux83fk",
  node: "Ind-01.mutiny",
  tabs: { activeStakes: 3, settledWon: 18, createdPools: 4 },
};

const PROFILE_STATS: ProfileStat[] = [
  {
    id: "total-staked",
    label: "Total Staked",
    value: "420.50",
    unit: "USDT",
    note: "-0.00641 BTC locked",
    noteTone: "emerald",
    icon: "account_balance_wallet",
    iconTone: "indigo",
  },
  {
    id: "win-rate",
    label: "Win Rate",
    value: "78.4%",
    note: "18 Won / 5 Lost",
    noteTone: "slate",
    icon: "trending_up",
    iconTone: "blue",
  },
  {
    id: "active-streak",
    label: "Active Streak",
    value: "14",
    unit: "Days",
    note: "Personal Best: 21 Days",
    noteTone: "rose",
    icon: "local_fire_department",
    iconTone: "rose",
  },
];

const PROFILE_STAKES: ProfileStake[] = [
  {
    id: "run-10km",
    title: "Run 10 km before 09:00",
    badge: { label: "In Progress", tone: "emerald" },
    icon: "directions_run",
    iconTone: "blue",
    meta: "Due today at 09:00 UTC",
    urgency: "3 hours left",
    stakeUsdt: "2.50",
    poolUsdt: "7.50",
    note: {
      icon: "link",
      text: "Proof: Strava GPS Activity Webhook",
      trailing: "6.8 / 10.0 km (68%)",
      boxed: false,
    },
    progress: { label: "6.8 / 10.0 km", percent: 68 },
    footer: "Oracle: Strava v3 / DLC #8942-B",
    actions: [
      { label: "View DLC Contract", tone: "ghost" },
      { label: "Sync Proof", tone: "primary", icon: "sync" },
    ],
  },
  {
    id: "leetcode-3hard",
    title: "Solve 3 LeetCode Hard",
    badge: { label: "Arbiter Review", tone: "violet" },
    icon: "smart_display",
    iconTone: "violet",
    meta: "Submitted 28 mins ago",
    urgency: "Awaiting Goaly Sig",
    stakeUsdt: "15.00",
    poolUsdt: "30.00",
    note: {
      icon: "code",
      text: "LeetCode #123, #42, #84 Submitted via Github Oracle",
      trailing: "3/3 Tests Passed",
      boxed: true,
    },
    footer: "DLC Multi-Sig: 2 of 3 (Goaly + Challenger)",
    actions: [
      { label: "Inspect Oracle Log", tone: "ghost" },
      { label: "Share Bet", tone: "cyan", icon: "share" },
    ],
  },
  {
    id: "wake-up-0630",
    title: "Wake up at 06:30 AM",
    badge: { label: "Starts Tomorrow", tone: "blue" },
    icon: "schedule",
    iconTone: "slate",
    meta: "Alarm window: 06:20 - 06:35 AM Local",
    urgency: "Pool Closes in 8 hours",
    stakeUsdt: "5.00",
    poolUsdt: "20.00",
    note: {
      icon: "schedule",
      text: "Proof Oracle: SleepCycle Biometric + Mutinynet Taproot Witness",
      trailing: "4 Challengers in pool",
      boxed: false,
    },
    footer: "Collateral safely escrowed in Discreet Log Contract",
    actions: [
      { label: "Pool Details", tone: "ghost" },
      { label: "Pair Sensor", tone: "primary", icon: "sensors" },
    ],
  },
];

const PROFILE_ARBITER: ProfileArbiter = {
  name: "Goaly Arbiter",
  role: "Chief Autonomous Referee",
  verified: true,
  quote: [
    { text: "Mert is on fire with a " },
    { text: "14-day streak!", bold: true },
    {
      text: " No disputed or spoofed proofs detected on Mutinynet. You are eligible for ",
    },
    { text: "High-Roller Pools", emphasis: "violet" },
    { text: " this weekend." },
  ],
  rows: [
    { label: "Auto-settlement rate", value: "100% On-Chain DLC", tone: "emerald" },
    { label: "Dispute Rate", value: "0.00%", tone: "slate" },
    { label: "Fastest Oracle Verify", value: "1.4s (Lightning)", tone: "emerald" },
  ],
  logLabel: "View Arbiter Audit Log",
};

export const WALLET_BALANCE: WalletBalance = {
  network: "Testnet",
  usdt: "84.50",
  tbtc: "0.01205",
};

export function getProfileSnapshot(): ProfileSnapshot {
  return {
    profile: USER,
    stats: PROFILE_STATS,
    stakes: PROFILE_STAKES,
    arbiter: PROFILE_ARBITER,
    balance: WALLET_BALANCE,
  };
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__resetGoalDiggerMocks =
    resetChallenges;
}
