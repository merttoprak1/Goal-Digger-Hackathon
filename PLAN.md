# Goal Digger hackathon plan

Status: restart in small steps on qvac-RGB. The earlier app skeleton was removed. Local QVAC inference, the RGB connection check, and GET /health now work.

## Product rules

The creator stakes USDT on completing a challenge. Other participants can only bet against the creator. All stakes form one pool.

- Success: the creator receives the entire pool.
- Failure: opponents split the entire pool in proportion to their confirmed stakes.
- Unclear evidence: the creator can retry or supply additional evidence before the proof deadline.
- No accepted proof by the deadline: the creator loses. Missing or unclear proof does not trigger a refund.
- Charity is optional. The Comeback Vault and recovery mechanic are no longer part of the core product.

Example: the creator stakes 5 USDT. Alice stakes 5 and Bob stakes 10 against the creator. The pool contains 20 USDT.

Success pays the creator 20 USDT. Failure pays Alice approximately 6.67 and Bob 13.33 USDT. Implementation must define exact rounding for asset precision.

## Challenge templates

| Template | Success rule | Proof |
|---|---|---|
| Wake up on time | Solve a fresh math problem during the agreed time window | The app records the answer and submission time. This establishes a timely response. |
| Pass an exam | Meet the declared passing grade for the named exam | A university transcript or official results page showing the exam and grade |
| Complete a run | Reach the declared distance before the deadline | An activity record from the declared fitness service showing distance, date, and duration |
| Custom | Meet the creator's exact success rule | The creator declares acceptable evidence and its source before betting opens |

Every challenge displays its goal, success rule, proof method, source, timezone, betting cutoff, and proof deadline before anyone bets.

After the first opponent bets, the creator cannot change those terms. Betting must close before the challenge starts or the outcome becomes known.

QVAC assesses evidence against the declared rules. Document appearance alone does not establish authenticity. Participants must see the proposed proof source before betting.

## Team and runtime

| Owner | Responsibility |
|---|---|
| Mert | Local QVAC, RGB node, integration endpoints, and the integrated demo |
| Vesim | React interface, challenge forms, evidence submission, and pool display |
| Ege | Challenge rules, SQLite, stake records, deadlines, and settlement logic |

QVAC and the RGB node run on Mert's laptop. Integrate the frontend and backend there for the demo.

Agree on the API and example responses first. Teammates can develop against explicit fixtures until the local integrations work.

## Git rules

Use a normal commit and push for every completed step. No stash, rebase, force push, or rewriting published history.

Fetch before integration. If branches diverge, preserve both histories with a normal merge. Keep secrets and wallet data outside Git.

## 1. Define the API and settlement rules

Estimate: 30 minutes.

Define challenge, bet, evidence, verdict, and payment records. Use integer asset units for amounts and explicit timezones for deadlines.

Decide wallet custody, the behavior when nobody bets, and the handling of service failures before accepting stakes. These remain open decisions.

Done when: all three teammates share request examples and the same payout rules.

## 2. Prove the local integrations

Estimate: 90–150 minutes.

Run local QVAC inference with suitable evidence. Test accepted, rejected, and unclear evidence. Check the installed model's actual input support.

Complete a real RGB transfer on Mutinynet and confirm receipt. Record the asset identifier and precision. Label test assets accurately in the interface.

QVAC CLI 0.15.0 and the unlocked RGB node on port 3001 passed connection checks. The local health endpoint now checks both services.

Done when: local inference and a real transfer work independently.

## 3. Build the first complete challenge

Estimate: 3–4 hours, in small commits.

Use TypeScript, React/Vite, Express, and SQLite. Keep QVAC and wallet access behind the local server.

1. Add the app skeleton, secret exclusions, and shared API definitions.
2. Implement challenge creation and display its fixed proof terms.
3. Accept the creator's stake and opponents' bets after confirmed payment.
4. Collect evidence and return a structured verdict with a reason.
5. Settle success or failure and show the actual payment status.

Start with the timed math challenge. The server must generate fresh problems and check answers and timestamps directly.

QVAC must perform a meaningful local assessment, such as extracting a handwritten answer for deterministic checking. Test this before selecting the final input flow.

Treat payouts as pending until confirmed. Store transfer identifiers and prevent duplicate settlement after retries or restarts.

Done when: success and failure both produce real test payouts without manual database changes.

## 4. Add the other challenge options

Estimate: 2–3 hours.

Add the exam, run, and custom forms with visible proof terms. Add evidence retries until the deadline and automatic failure for missing accepted proof.

Test proportional payouts, rounding, late bets, late evidence, failed transfers, repeated requests, and restarts. Keep evidence handling local and document retention.

Done when: each option preserves the same betting and settlement rules. Label any incomplete verification method clearly.

WDK, speech, and charity are stretch work after the required flow works. WDK must handle an actual wallet operation to support the bonus claim.

## 5. Prepare the live demo and submission

Estimate: 90 minutes, plus time for integration failures.

Rehearse a three-minute demo with multiple participants, prepared test funds, and local models. Show why both RGB and local QVAC matter.

Update the README with setup steps, prior work, limitations, mocks, and exact integration operations.

Push the final commit to main before October 18, 2026, at 13:00 CEST. Prepare a five-minute finalist pitch and presentation PDF if selected.

Done when: another teammate can start the app from the README and repeat the demo.

## Sources

The event PDFs and resource spreadsheet are in the parent workspace's HackathonOfficialFiles folder. They are not included in this repository.

- [RGB documentation](https://docs.rgb.info/)
- [QVAC documentation](https://docs.qvac.tether.io/quickstart/)
- [Event builder kit](https://kaleidoswap.github.io/rgb-hackathon/)

## Next small step

Follow [TASKS.md](TASKS.md), one task at a time. POST /qvac/ask is complete. The fixed math assessment is complete. The next task is reading RGB balances and assets. The earlier shared API contract was removed with the app skeleton.
