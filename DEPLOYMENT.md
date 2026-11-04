# Deploy x402 Agent Buyer to the connected Cloudflare Worker

## Expected public URL

https://x402-agent-buyer.trantanlong2411.workers.dev/

The exact address printed in your Cloudflare Dashboard is authoritative. If it differs, use that URL in the reviewer proof and update the test's `BUYER_WORKER_URL` environment variable.

## Cloudflare Git integration

1. Open Cloudflare Dashboard → Workers & Pages → **x402-agent-buyer** → **Settings → Builds**.
2. Production GitHub repository: `trantanlong2411-droid/x402-Agent-Buyer`.
3. Branch: `main`. Root: `/`. Deploy command: **`npx wrangler deploy`**.
4. Do **not** use `npm run build` as the deploy command; it creates a dry-run test bundle, not an active Worker.
5. Wrangler `wrangler.jsonc` includes the `BUYER_TASKS` Durable Object binding for `BuyerTask` and `new_sqlite_classes` migration. Cloudflare creates it during deployment. No D1 setup is needed.
6. No buyer private key, seed phrase, wallet secret, Cloudflare API token or merchant facilitator key should be present in this project. The buyer signs in its own external EVM browser wallet.

## Variables (public)

- `SELLER_ORIGIN=https://x402-paywalled-api.trantanlong2411.workers.dev` — the trusted merchant already built by this project owner.
- `ATLANTIC_RPC_URL=https://atlantic.dplabs-internal.com` — Pharos Atlantic Testnet.
- The buyer Worker allows no dynamic external endpoint to be supplied by a public API request; only its explicitly configured merchant origin is used.

## After production deploy

Open these public endpoints:
- `GET /api/health`: `ok:true`, `network:"eip155:688689"`, `durableStorage:true`, `spendLimitEnforced:true`, `signingKeyOnServer:false`, and current version `pharos-x402-agent-buyer-2026-11-05-v2`.
- `GET /api/demo`: two labeled `DRY_RUN_ONLY` examples, `SIMULATED_COMPLETED` and `SIMULATED_STOPPED_BUDGET`. Both show null hashes; no payments are sent.
- `POST /api/task`: the browser creates a UUIDv4 task and shows a private saved task key; do not share that key in reviewer notes.

Run the [deployed Worker + real merchant quote test](https://github.com/trantanlong2411-droid/x402-Agent-Buyer/actions/workflows/verify-deployed.yml) to verify live Durable Object storage, actual 402 amounts, valid budget-stop behavior and no-charge invalid signature denial.

## Completing the Hard task for real

Use an EVM **buyer wallet on Pharos Atlantic Testnet (688689)** that is funded with at least **0.004 test USDC** on contract `0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B`. Do not use the facilitator's secret or assume that merely signing is a successful transfer. The existing merchant has a buyer-balance inspection button.

1. Connect the buyer on the agent's homepage.
2. Start a **Complete research bundle** task with total budget 0.010 USDC, per-call cap 0.005 USDC.
3. Click **Advance agent**. It obtains `/api/insights` HTTP 402 at 0.001 USDC and checks both limits.
4. Click **Sign & pay approved step**. Your browser wallet shows an EIP-712 testnet payment authorization. Review and approve only if you intend to spend test USDC.
5. The merchant facilitator broadcasts the transfer. Only after HTTP 200, PAYMENT-RESPONSE and a matching independent Atlantic receipt does the buyer record the price and tx hash.
6. The agent retrieves the next price for `/api/report` at 0.003 USDC; approve the second authorization separately.
7. A successful on-chain run has state **COMPLETED**, 2 purchases, 2 different explorer hashes and running total **0.004 USDC**.
8. For the budget-stop scenario, choose task budget 0.002, cap 0.005: after the first 0.001 purchase the next 0.003 quote is refused. Or set budget 0.0005 for a zero-cost stop at the first quote.
9. An uncertain payment stays **NEEDS_RECONCILIATION** and the app blocks new signatures. Do not sign another payment blindly. If there is a known hash, click **Recheck known transaction**. Manual reconciliation with the merchant facilitator may still be needed if the hash is unavailable.

The system is testnet-only. The buyer cannot promise a real 200 or explorer link without a wallet owner explicitly signing and the merchant successfully settling. Keep the private task key private: share only public transaction hashes and the homepage/repo URLs for proof.

## Test commands

```bash
npm install
npm test
npm run build
npx wrangler deploy
```

The seller used in this project must be running and facilitator-ready, including its own funded testnet PHRS relayer and a USDC receiving address.

Official sources: [x402 v2 HTTP protocol](https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/http.md), [Pharos Atlantic x402 documentation](https://docs.pharos.xyz/developer-guide/x402/x402-atlantic-testnet).
