# x402 Agent Buyer — reviewer evidence

## Verified deployed production status — 5 November 2026 (Asia/Ho_Chi_Minh)

The [Cloudflare production end-to-end readiness run](https://github.com/trantanlong2411-droid/x402-Agent-Buyer/actions/runs/41899349893) **PASSED** for Buyer Worker v4. The run checked actual Atlantic RPC block **32317150**, USDC contract balanceOf, persisted task state, both real merchant 402 routes at 0.001/0.003 USDC, budget refusal *before signing*, and invalid signed payload rejection. It also checked both clearly labeled budget demos. [Permanent compact evidence](./verified-deployed-readiness.json) is available, along with the GitHub Actions artifact.

The [latest unit/Worker build run](https://github.com/trantanlong2411-droid/x402-Agent-Buyer/actions/runs/41899349890) passed **13/13 tests**.

**Not yet proven:** A real buyer task with two independently verified paid USDC transfer hashes and completed job state. This requires the owner to connect/fund a Pharos Atlantic buyer wallet and approve the EIP-712 signatures. Neither the test run nor dry runs moved tokens.



**Pharos Agent Arena / HARD / PAYMENTS — x402 Agent Buyer**

- **Proof Link (once live):** https://x402-agent-buyer.trantanlong2411.workers.dev/
- **Repo:** https://github.com/trantanlong2411-droid/x402-Agent-Buyer
- [Unit/build workflow](https://github.com/trantanlong2411-droid/x402-Agent-Buyer/actions/workflows/verify.yml)
- [Deployed Worker + merchant quote workflow](https://github.com/trantanlong2411-droid/x402-Agent-Buyer/actions/workflows/verify-deployed.yml)
- **Merchant:** https://x402-paywalled-api.trantanlong2411.workers.dev/

## Real on-chain transaction audit — 5 November 2026

The [successful independent Atlantic RPC check](https://github.com/trantanlong2411-droid/x402-Agent-Buyer/actions/runs/41988630613) decoded the two user-provided hashes and proved both transactions **succeeded** on Atlantic, with EIP-3009 transfer authorization, USDC contract and matching ERC-20 Transfer events:

| Hash | Block | USDC transferred | Buyer → receiving wallet |
| --- | --- | --- | --- |
| [0x4aac6200…2db30](https://atlantic.pharosscan.xyz/tx/0x4aac620082af15d20b12543a7c39fc853fbeda76ac89c2c641c5bd597ec2db30) | 32340108 | 0.001 | same wallet (self-transfer) |
| [0x6527281d…e7118](https://atlantic.pharosscan.xyz/tx/0x6527281d3034e025466aacbf6809f6c6993fa06597dea0886d45fc0e9d8e7118) | 32340222 | 0.001 | same wallet (self-transfer) |

Both used `0x4Fe2CC4Ce85fD93F327E2e121213474247F65242` as payer **and** recipient. User-reported prices 0.005/0.003 were not the observed transfer amounts. These hashes are **not sufficient** to show purchases of the two different priced resources (0.001 Insights and 0.003 Report) or a completed buyer task. Evidence: [JSON](./user-reported-two-tx-audit.json).

The buyer code now refuses self-payments before signing and before counting receipts. To complete this Hard task, use a **different funded Buyer wallet**, sign one 0.001 Insights payment and a separate 0.003 Report payment, confirm both real explorer hashes plus the agent's `COMPLETED` status and `0.004 USDC` total, and show a `STOPPED_BUDGET` task. Do not share a private task key.

## Five required criteria and evidence

1. **Two distinct endpoints:** live `/api/insights` at price 0.001 USDC, `/api/report` at price 0.003 USDC. Their actual challenges are separately retrieved, not invented.
2. **Total budget and per-call price cap:** both validated atomically before any signature. A cap exceeded turns task `STOPPED_PRICE_CAP`; total exceeded turns `STOPPED_BUDGET`.
3. **Full purchase ledger:** only matching Atlantic confirmed ERC-20 transfer contributes to spentAtomic and running total. Log includes exact token price, what was bought, receipt hash and time.
4. **Safe failures and retries:** `SETTLEMENT_PENDING` is stored before payment submission; `NEEDS_RECONCILIATION` refuses new signatures on uncertainty. Only a known no-charge, insufficient-balance rejection permits manual retry. Duplicate finalization cannot add to spending twice.
5. **One successful demo and one budget-stop demo:** homepage provides explicit `DRY_RUN_ONLY` examples that illustrate both decisions without real funds. **To demonstrate a real paid complete task**, the user must sign one 0.001-USDC authorization and a separate 0.003-USDC authorization, then show the resulting two explorer hashes and final state `COMPLETED`. For budget-stop task, use 0.002 total budget/0.005 cap to refuse second resource after first verified purchase, or budget 0.0005 to stop immediately at no cost.

## Evidence integrity

- Unit tests prove the program's price decision, receipt matching and idempotent accounting using deterministic mocks; they do not demonstrate actual live payment.
- Deployed smoke test proves running Worker, two 402 merchant quotes, a no-signature budget stop, a rejected invalid signature, and clearly labeled dry-run examples.
- Real signed payments **must be performed in the browser** by a funded Pharos Atlantic testnet wallet. No keys in repository or service, no invented tx hashes. Only submit full claim after reviewer-accessible verified hashes are present.
- After a successful live task, share **only public explorer transaction URLs**, never the private task access key or private wallet keys.

See [README](../README.md) for detailed instructions. x402 v2 official HTTP transport: https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/http.md
