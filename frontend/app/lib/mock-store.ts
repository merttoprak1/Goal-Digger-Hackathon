import type {
  ArbiterProfile,
  Challenge,
  ChallengesSnapshot,
  ChallengeTemplate,
  CreateChallengeRequest,
  EscrowHold,
  PayoutHistoryRow,
  PayoutPool,
  PayoutSnapshot,
  ProfileArbiter,
  ProfileSnapshot,
  ProfileStake,
  ProfileStat,
  ProtocolStatus,
  UserProfile,
  WalletBalance,
  WalletEntry,
  WalletSnapshot,
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
  statusText: "Goaly is supervising the chain...",
  greeting: [
    "Yo! Ready to put your USDT where your mouth is? Name your challenge and stake, or pick a preset below. No slackers allowed on Mutinynet!",
    "Hey! Stop poking the Arbiter and go finish your challenges!",
    "Microphone & proof feed calibrated. All systems active!",
  ],
  replyQuotes: [
    "Contract terms noted! Locking your timelock on Mutinynet. Don't disappoint the arbiter!",
    "I will be personally validating the proof feed. If you fail, the counterparty takes the pool!",
    "DLC terms registered on Bitcoin testnet. You've got the guts, now bring the proof!",
    "Stake accepted. The blockchain never lies, and neither do I. Get to work!",
    "Target locked in my crosshairs. Submit your cryptographic proof before the deadline!",
  ],
};

/** Mascot click / audio-toggle lines, matching the source design's behaviour. */
export const ARBITER_POKE_LINE =
  "Hey! Stop poking the Arbiter and go finish your challenges!";
export const ARBITER_CALIBRATION_LINE =
  "Microphone & proof feed calibrated. All systems active!";

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
      action: { kind: "button", label: "Bet Against" },
      proofDeadline: "2026-10-18T09:00:00+00:00",
      createdAt: "2026-10-16T06:12:00.000Z",
      viewer: { staked: true, created: false, won: false },
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
      viewer: { staked: false, created: false, won: false },
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
      action: { kind: "button", label: "Join Pool" },
      proofDeadline: "2026-10-26T06:30:00+00:00",
      createdAt: "2026-10-16T10:02:00.000Z",
      viewer: { staked: true, created: true, won: false },
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
      action: { kind: "button", label: "Challenge" },
      proofDeadline: "2026-11-02T23:59:00+00:00",
      createdAt: "2026-10-17T07:20:00.000Z",
      viewer: { staked: true, created: false, won: false },
    },
    {
      id: "read-30min",
      title: "Read 30 minutes daily",
      creator: "Nil",
      status: "settled",
      template: TEMPLATE_LABELS.custom.label,
      templateEmoji: TEMPLATE_LABELS.custom.emoji,
      stakeUsdt: "4",
      poolUsdt: "8.40",
      proofSource: "Kindle reading log",
      action: {
        kind: "info",
        label: "🏆 Settled · Won",
        note: "Paid 8.40 USDT to your wallet",
      },
      proofDeadline: "2026-10-12T20:00:00+00:00",
      createdAt: "2026-10-05T07:30:00.000Z",
      viewer: { staked: true, created: false, won: true },
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
    viewer: { staked: true, created: true, won: false },
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
    footer: "Proof: Strava v3 / DLC #8942-B",
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
      text: "LeetCode #123, #42, #84 Submitted via the GitHub mirror",
      trailing: "3/3 Tests Passed",
      boxed: true,
    },
    footer: "DLC Multi-Sig: 2 of 3 (Goaly + Challenger)",
    actions: [
      { label: "Inspect Arbiter Log", tone: "ghost" },
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
      text: "Proof Source: SleepCycle Biometric + Mutinynet Taproot Witness",
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
    { label: "Fastest Attestation", value: "1.4s (Lightning)", tone: "emerald" },
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

/* --------------------------------- wallet -------------------------------- */

/** Trim a raw number to the two decimals the ledger shows. */
function money(value: number): string {
  return value.toFixed(2);
}

interface WalletState {
  network: string;
  address: string;
  lockedUsdt: number;
  tbtcUsd: string;
  holds: EscrowHold[];
  entries: WalletEntry[];
}

/**
 * The spendable side of the wallet is `WALLET_BALANCE`, so the profile balance
 * card and this screen can never disagree. Only the escrow side lives here.
 */
const WALLET: WalletState = {
  network: "Mutinynet",
  address: USER.walletAddress,
  lockedUsdt: 10,
  tbtcUsd: "$1,284.40",
  holds: [
    {
      id: "run-10km",
      title: "Run 10 km before 09:00",
      amountUsdt: "2.50",
      via: "DLC #8942-B",
    },
    {
      id: "leetcode-3hard",
      title: "Solve 3 LeetCode Hard",
      amountUsdt: "5.00",
      via: "DLC #8951-A",
    },
    {
      id: "wake-up-0700",
      title: "Wake up at 07:00",
      amountUsdt: "2.50",
      via: "DLC #8960-C",
    },
  ],
  entries: [
    {
      id: "w-payout-7721",
      label: "Payout received",
      detail: "Pool #7721 • Zero sugar for 3 days",
      amount: "+18.20",
      unit: "USDT",
      kind: "payout",
      badge: { label: "Confirmed", tone: "emerald" },
      timestamp: "2 hours ago",
    },
    {
      id: "w-lock-8960",
      label: "Stake locked",
      detail: "DLC #8960-C • Wake up at 07:00",
      amount: "-2.50",
      unit: "USDT",
      kind: "lock",
      badge: { label: "Locked", tone: "blue" },
      timestamp: "5 hours ago",
    },
    {
      id: "w-release-8907",
      label: "Stake released",
      detail: "DLC #8907-D expired, stake refunded",
      amount: "+2.50",
      unit: "USDT",
      kind: "release",
      badge: { label: "Confirmed", tone: "emerald" },
      timestamp: "Yesterday",
    },
    {
      id: "w-fee-3f9c",
      label: "Miner fee",
      detail: "Taproot funding tx 3f9c…71a2",
      amount: "-0.00001200",
      unit: "tBTC",
      kind: "fee",
      badge: { label: "Confirmed", tone: "emerald" },
      timestamp: "Yesterday",
    },
    {
      id: "w-deposit-faucet",
      label: "Deposit",
      detail: "Mutinynet faucet",
      amount: "+50.00",
      unit: "USDT",
      kind: "deposit",
      badge: { label: "Confirmed", tone: "emerald" },
      timestamp: "3 days ago",
    },
    {
      id: "w-lock-8951",
      label: "Stake locked",
      detail: "DLC #8951-A • Solve 3 LeetCode Hard",
      amount: "-5.00",
      unit: "USDT",
      kind: "lock",
      badge: { label: "Locked", tone: "blue" },
      timestamp: "4 days ago",
    },
  ],
};

function walletStats(): ProfileStat[] {
  return [
    {
      id: "available",
      label: "Available",
      value: WALLET_BALANCE.usdt,
      unit: "USDT",
      note: "Ready to stake or cash out",
      noteTone: "emerald",
      icon: "account_balance_wallet",
      iconTone: "indigo",
    },
    {
      id: "locked",
      label: "Locked in Escrow",
      value: money(WALLET.lockedUsdt),
      unit: "USDT",
      note: `${WALLET.holds.length} active DLCs`,
      noteTone: "blue",
      icon: "lock",
      iconTone: "blue",
    },
    {
      id: "tbtc",
      label: "tBTC Reserve",
      value: WALLET_BALANCE.tbtc,
      unit: "tBTC",
      note: `≈ ${WALLET.tbtcUsd} paying the fees`,
      noteTone: "slate",
      icon: "currency_bitcoin",
      iconTone: "indigo",
    },
  ];
}

export function getWalletSnapshot(): WalletSnapshot {
  return {
    network: WALLET.network,
    address: WALLET.address,
    availableUsdt: WALLET_BALANCE.usdt,
    lockedUsdt: money(WALLET.lockedUsdt),
    tbtc: WALLET_BALANCE.tbtc,
    tbtcUsd: WALLET.tbtcUsd,
    stats: walletStats(),
    holds: WALLET.holds,
    entries: WALLET.entries,
  };
}

/* --------------------------------- payout -------------------------------- */

const PAYOUT = {
  claimableUsdt: 23.2,
  awaitingUsdt: 12.5,
  lifetimeUsdt: 184.6,
  settledCount: 18,
  claimable: [
    {
      id: "p-leetcode",
      title: "Solve 3 LeetCode Hard",
      amountUsdt: "12.50",
      proof: "Goaly read three accepted submissions from the GitHub mirror",
      timing: "Settled 2 hours ago",
    },
    {
      id: "p-sugar",
      title: "Zero sugar for 3 days",
      amountUsdt: "10.70",
      proof: "Goaly cleared every photo in the food log",
      timing: "Settled yesterday",
    },
  ] as PayoutPool[],
  pending: [
    {
      id: "p-run",
      title: "Run 10 km before 09:00",
      amountUsdt: "7.50",
      proof: "Goaly verified the Strava GPS track",
      timing: "Epoch closes in 3 hours",
    },
    {
      id: "p-wake",
      title: "Wake up at 06:30 AM",
      amountUsdt: "5.00",
      proof: "Goaly verified the SleepCycle export",
      timing: "Epoch closes in 6 hours",
    },
  ] as PayoutPool[],
  history: [
    {
      id: "h-read",
      title: "Read 30 minutes daily",
      amountUsdt: "8.40",
      result: "won",
      at: "12 Oct 2026",
    },
    {
      id: "h-commit",
      title: "Commit code every day",
      amountUsdt: "5.00",
      result: "lost",
      at: "09 Oct 2026",
    },
    {
      id: "h-shower",
      title: "Cold shower streak",
      amountUsdt: "15.00",
      result: "won",
      at: "05 Oct 2026",
    },
    {
      id: "h-sugar",
      title: "Zero sugar for 3 days",
      amountUsdt: "4.00",
      result: "lost",
      at: "01 Oct 2026",
    },
  ] as PayoutHistoryRow[],
};

export function getPayoutSnapshot(): PayoutSnapshot {
  return {
    claimableUsdt: money(PAYOUT.claimableUsdt),
    awaitingUsdt: money(PAYOUT.awaitingUsdt),
    lifetimeUsdt: money(PAYOUT.lifetimeUsdt),
    settledCount: PAYOUT.settledCount,
    claimable: PAYOUT.claimable,
    pending: PAYOUT.pending,
    history: PAYOUT.history,
  };
}

/**
 * Move one settled pool into the wallet: the claim leaves the payout queue,
 * lands in the spendable balance and leaves a ledger entry behind. Mirrors the
 * escrow release the RGB layer will perform once it is wired up.
 */
export function claimPayout(id: string): PayoutSnapshot | null {
  const index = PAYOUT.claimable.findIndex((pool) => pool.id === id);
  if (index === -1) return null;

  const [pool] = PAYOUT.claimable.splice(index, 1);
  const amount = Number(pool.amountUsdt);

  PAYOUT.claimableUsdt = Number((PAYOUT.claimableUsdt - amount).toFixed(2));
  WALLET_BALANCE.usdt = money(Number(WALLET_BALANCE.usdt) + amount);
  WALLET.entries.unshift({
    id: `w-claim-${pool.id}`,
    label: "Payout claimed",
    detail: `Pool settled • ${pool.title}`,
    amount: `+${pool.amountUsdt}`,
    unit: "USDT",
    kind: "payout",
    badge: { label: "Confirmed", tone: "emerald" },
    timestamp: "Just now",
  });

  return getPayoutSnapshot();
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__resetGoalDiggerMocks =
    resetChallenges;
}
