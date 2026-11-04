# x402 Agent Buyer — Pharos Agent Arena

**Hard / Payments · 200 points (+50 optional video)**  
**Network:** Pharos Atlantic Testnet, `eip155:688689`  
**Live application / intended Proof Link:** https://x402-agent-buyer.trantanlong2411.workers.dev/  
**Source:** https://github.com/trantanlong2411-droid/x402-Agent-Buyer

A payment-aware x402 **buyer agent** that accepts a multi-step task, requests the actual merchant's HTTP 402 challenges, evaluates prices using two independent spending limits, buys protected API data through **user-approved EIP-712 signatures**, checks on-chain settlement receipts and maintains a persistent payment ledger with **transaction hash, item purchased, price and running total**.

It uses our previously built and deployed [x402 Paywalled API](https://x402-paywalled-api.trantanlong2411.workers.dev/) as the live merchant. The buyer calls two *different* paid routes: `/api/insights` at 0.001 test USDC and `/api/report` at 0.003 test USDC (prices are read live from 402; not trusted blindly).

## Rubric mapping (all five requirements)

| Requirement | Actual feature |
| --- | --- |
| 1. Call two different x402 endpoints | Plan includes both merchant `/api/insights` and `/api/report`, each obtained by a **live HTTP 402**. A successful live buyer task purchases both after wallet authorization. |
| 2. Total spend budget + per-call price cap | Every quoted amount is checked against both limits in USDC atomic 6-decimal integer units. A quote exceeding either limit sets `STOPPED_BUDGET` or `STOPPED_PRICE_CAP` **before signing**. A global hard safety ceiling of 0.05 USDC per request provides additional protection. |
| 3. Log price, item, transaction hash, running total | SQLite Durable Object stores a private task journal with price, what was bought, transaction hash, verified USDC Transfer log, task state and accumulated spend. **Only** a matched actual on-chain transaction increments the paid total. |
| 4. Safe retries / never double-paying | Task state is persisted as `SETTLEMENT_PENDING` before forwarding a signed authorization once. If the response may have been lost or settlement is uncertain, the agent enters `NEEDS_RECONCILIATION` and **refuses a new signature**. A safe explicit retry is allowed only when the merchant definitively rejects for insufficient USDC before broadcasting. Existing PAID entries are idempotent. |
| 5. Successful demo task and budget-stop demo | The homepage shows clearly labeled `DRY_RUN_ONLY` examples: one simulated job completes after both prices fit a 0.005 budget, another stops before the second purchase at a 0.002 budget. It also exposes two **live** task presets. The live completion demo requires a funded testnet buyer wallet and **two actual signed payments**; no fake hash or simulated payment is treated as live evidence. |

### Architecture

- **Cloudflare Worker (`src/worker.mjs`):** trusted merchant request proxy, runtime quote validation, task routing and settlement gating.
- **SQLite-backed Durable Object (`BuyerTask`):** one private access-keyed journal per buyer task; creates/reuses quotes and records durable payment states, purchase results and total spend.
- **Policy (`src/policy.mjs`):** hard caps, budgets, strict Atlantic USDC quote parsing, EIP-712 verification, replay detection, idempotent payment accounting and clearly labeled dry-run tasks.
- **Chain verifier (`src/chain.mjs`):** independently queries Atlantic JSON-RPC transaction and receipt, checks chain 688689, successful execution, EIP-3009 `transferWithAuthorization` and exact USDC `Transfer` event matching the task's payer, merchant and amount.
- **Client (`src/page.mjs`):** responsive web demo, prompts only for EIP-1193 buyer wallet signing on explicit user click. It never accesses a raw private key, seed phrase or server-side wallet.
- **Unit and deployed tests:** GitHub Actions verification of strict budgets, correct two 402 quotes, no-double-count accounting, invalid signed payload blocking and production Workers runtime.

A task stores **no raw signing key or signed authorization**. It stores an authorization identifier/hash (not its reusable signature) and the resulting transaction hash only after it becomes known. A private UUIDv4 task access key is stored locally in the browser for convenience. Keep it private; someone with the key can inspect the task even though they cannot sign as the buyer.

## Reviewer walkthrough — both scenarios

### Demo A: complete a real buyer task (requires test USDC)

1. Open the [deployed agent homepage](https://x402-agent-buyer.trantanlong2411.workers.dev/) and connect a **buyer testnet wallet** on chain 688689. This should be **different from your facilitator wallet**. Use dedicated testnet funds only.
2. Confirm the buyer wallet has at least **0.004** test USDC of Circle Atlantic USDC `0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B`. The merchant's [balance check](https://x402-paywalled-api.trantanlong2411.workers.dev/) can confirm the exact contract; a faucet transfer must go to this buyer.
3. Choose **Complete research bundle**. Set total budget `0.010` and per-call price cap `0.005`.
4. Click **Create & start task**. Save the random private task key (do not share in public proof).
5. Click **Advance agent / check next price**. The agent calls the real Insights route, reads 402 and accepts **0.001** USDC only because both limits permit it.
6. Click **Sign & pay approved step**, review the wallet prompt and sign testnet EIP-712. The buyer Worker sends that authorization once to the seller, which verifies and broadcasts using its own facilitator. The buyer independently checks the real receipt before recording PAID and the transaction hash.
7. After the first paid result is verified, the buyer automatically fetches only the **next quote**, not another signature. Sign the separate 0.003 USDC Report payment if you agree.
8. Once both receipts verify, the task shows **COMPLETED**, two distinct bought API resources, **two actual explorer transaction hashes** and running total **0.004 USDC**. If any payment stays uncertain, the task blocks further purchases until manually reconciled: do not re-sign blindly.

### Demo B: stop at the budget

1. Choose **Budget stop — decline second API request**, total budget `0.002`, per-call cap `0.005`.
2. Run the live job with the same funded buyer. The 0.001 Insights purchase is within both limits; the next Report quote costs 0.003, bringing potential spend to 0.004, over the 0.002 total cap.
3. The agent sets **STOPPED_BUDGET** and **never** signs or buys the second item. It records why it refused.
4. **Zero-charge budget stop:** set budget to `0.0005` (cap `0.005`). The first 0.001 quote is refused before any signature; no test USDC is sent.
5. For a review without tokens, click **Run both dry-run demos**. These demonstrate the identical price decisions but explicitly show `DRY_RUN_ONLY` and `txHash:null`. **They are not proof of a real signed x402 settlement.**

## Operational safety and failure modes

- All monetary comparisons use integer atomic units, not floating-point JS totals.
- Only fixed trusted HTTPS merchant origin, EIP-3009 exact x402 v2, Atlantic network 688689 and the Circle USDC contract are accepted.
- Live price quotes originate from **both** actual 402 routes. Malformed, wrong-network, wrong-asset, changed-price or wrong-resource quotes are rejected.
- Signed payload must match the exact approved offer, task's buyer EVM address, payTo recipient, amount, nonce and EIP-712 domain. Buyer has to explicitly approve every new payment in their wallet; the agent cannot move money itself.
- Upstream request uncertain / timeout: **NEEDS_RECONCILIATION**, no new signature allowed, zero confirmed spend until the chain proves settlement. If a real tx hash is known, click **Recheck known transaction**.
- Explicit **FAILED_NO_CHARGE** retry is allowed only for the verified merchant response “Insufficient test USDC balance” before the facilitator broadcasts. Retry fetches a fresh 402 price and requires another explicit wallet approval.
- A transaction is counted as PAID only if the merchant returns HTTP 200 with a matching **PAYMENT-RESPONSE**, and an independent on-chain successful receipt shows the exact `transferWithAuthorization` and USDC `Transfer` to the expected merchant.
- The seller's returned Insights and Report data is **demonstration content**, not investment advice or independently sourced trading analytics.
- Live paid transactions require actual testnet USDC; the app will never invent explorer hashes. Signing twice is not evidence of two successful settlements.

## Deploy through the linked Cloudflare Worker

GitHub repository is already linked to the user's Worker. Verify:

- Worker name: `x402-agent-buyer`
- Git repo: `trantanlong2411-droid/x402-Agent-Buyer`, branch `main`, root `/`
- Production deploy command: `npx wrangler deploy` (not `npm run build`, which only performs a dry-run bundle).
- The `BUYER_TASKS` Durable Object binding is created by the `new_sqlite_classes` Wrangler migration for `BuyerTask`. No D1 database, API tokens or buyer/facilitator private keys are needed on this Worker.
- `SELLER_ORIGIN` defaults to the existing merchant `https://x402-paywalled-api.trantanlong2411.workers.dev`.
- `ATLANTIC_RPC_URL` defaults to `https://atlantic.dplabs-internal.com`.

```bash
npm install
npm test
npm run build
npx wrangler deploy
```

Readiness endpoints:
- `GET /api/health` — app version, trusted merchant, chain 688689, durable storage status
- `GET /api/demo` — two clearly labeled dry-run task results, **no** blockchain transfer
- `POST /api/task` — stateful create/status/next/pay/retry/reconcile operations, with a high-entropy private task key.

## Evidence and submitting

- [Unit tests and Worker bundle](https://github.com/trantanlong2411-droid/x402-Agent-Buyer/actions/workflows/verify.yml)
- [Live deployed Worker/merchant quote tests](https://github.com/trantanlong2411-droid/x402-Agent-Buyer/actions/workflows/verify-deployed.yml)
- [Prior seller/facilitator deployment](https://github.com/trantanlong2411-droid/x402-Paywalled-API)

For **full Hard-task proof**, record the live task state **COMPLETED** with two exact testnet transaction hashes and `0.004` total, plus the budget-stop test state. The reviewer can inspect hashes using https://atlantic.pharosscan.xyz/tx/HASH. The homepage is the required **Proof Link**, and this repository is the optional Repo Link. Do not submit the dry-run alone as proof of the real payment capability.

### Primary protocol references

[x402 v2 spec](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md) · [x402 HTTP 402 transport](https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/http.md) · [Pharos Atlantic x402 docs](https://docs.pharos.xyz/developer-guide/x402/x402-atlantic-testnet) · [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009).
