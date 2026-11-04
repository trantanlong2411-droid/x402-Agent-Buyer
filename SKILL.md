---
name: pharos-x402-agent-buyer
description: Execute a two-resource x402 buyer task on Pharos Atlantic Testnet with explicit wallet approval, budget guards, verified payment logs and safe retries.
---
# x402 Agent Buyer — required procedure

1. Use the trusted HTTPS merchant `https://x402-paywalled-api.trantanlong2411.workers.dev` and two different x402 routes (`/api/insights`, `/api/report`); reject arbitrary URLs and wrong network or asset.
2. Require a public buyer wallet on Atlantic `eip155:688689` and a private random UUIDv4 task capability; never request a private key or seed phrase in chat, source files or the Worker.
3. Capture total budget and independent per-price cap in test USDC. Convert to 6-decimal atomic integers, enforce both at each live `402 PAYMENT-REQUIRED` challenge, and refuse a price over the global 0.05 USDC safety ceiling.
4. Persist a durable journal in Cloudflare SQLite Durable Object per task with purchased resource, amount, status, actual transaction hash and cumulative verified spend. A merchant quote and wallet signature are **not** evidence that payment succeeded.
5. Each paid API must obtain explicit user wallet approval of the precise EIP-712 `TransferWithAuthorization` payload; confirm the signer, receiver, price, token, chain, nonce and resource match the trusted quote. There is no automatic private-key signing.
6. Before calling the merchant with `PAYMENT-SIGNATURE`, persist `SETTLEMENT_PENDING`. Never send the same authorization a second time if the response is uncertain.
7. Require merchant HTTP 200 and actual `PAYMENT-RESPONSE`, then independently check Atlantic JSON-RPC successful receipt and exact EIP-3009 calldata plus USDC Transfer event. Only then mark PAID and increment the running total.
8. On definite no-charge balance rejection use `FAILED_NO_CHARGE` and permit an **explicit manual retry** after a new quote. On uncertain outcome use `NEEDS_RECONCILIATION`; require existing transaction hash verification, never automatic re-signing. A prior PAID entry is idempotent.
9. Task `bundle` completes only with two real paid receipts. Task `budget-stop` halts if the next price would exceed the chosen spending limit. Also offer honest clearly labeled `DRY_RUN_ONLY` examples (one simulated complete, one simulated budget stop) with null hashes.
10. Keep tests and actual deployed Worker evidence in GitHub Actions; only call the Hard task complete when a real funded buyer has obtained paid data for both routes and two independently verifiable transaction hashes.

Security: Cloudflare Worker has **no** buyer or facilitator signing secret; only user's browser wallet signs. No raw signed authorizations are written into stored logs. Do not overclaim a successful live purchase from mocked receipts or from a signature without settlement.
