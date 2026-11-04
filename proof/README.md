# x402 Agent Buyer — reviewer evidence

**Pharos Agent Arena / HARD / PAYMENTS — x402 Agent Buyer**

- **Proof Link (once live):** https://x402-agent-buyer.trantanlong2411.workers.dev/
- **Repo:** https://github.com/trantanlong2411-droid/x402-Agent-Buyer
- [Unit/build workflow](https://github.com/trantanlong2411-droid/x402-Agent-Buyer/actions/workflows/verify.yml)
- [Deployed Worker + merchant quote workflow](https://github.com/trantanlong2411-droid/x402-Agent-Buyer/actions/workflows/verify-deployed.yml)
- **Merchant:** https://x402-paywalled-api.trantanlong2411.workers.dev/

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
