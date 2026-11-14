# Operating costs

Figures are estimates from published list prices (Claude API prices as of 2026-11).
The platform records the **actual** cost of every paid call against its job, and the
Overview page shows real month-to-date spend. Your Anthropic and Google invoices are the
authoritative bill.

## Built so far (Phases 1–3)

| Item | Cost |
|---|---|
| YouTube Data API v3 | **$0**. Free quota of 10,000 units/day; normal use is under 100. |
| Claude research report, `claude-opus-5-5` (default) | **≈ $0.05–$0.15 per report**. About 3k–15k input tokens (title, description, optional transcript) at $4/M, plus 2k–4k output tokens at $20/M. |
| Same report on `claude-sonnet-5-5` | ≈ $0.02–$0.07 |
| Same report on `claude-haiku-5-5` | ≈ $0.001–$0.004 |
| Worst case reserved per report (budget guard) | ≈ $0.21 with no transcript, up to ≈ $0.55 with the longest allowed transcript (200,000 characters). Input estimate plus the 8,000-token output cap, priced at the most expensive known rate. Actual cost is usually far lower and replaces the reservation. |

**Example month:** 60 research reports on Opus 5.5 ≈ **$3–$9**, well inside the initial
USD 35–70 software target. That leaves most of the budget for voice (Phase 6) and hosting
(Phase 10).

## Safety controls in place

* **Monthly limit** (`budget.monthly_limit_usd`, default $50): each paid job reserves its
  worst-case cost under a database lock and is blocked if the total would exceed the
  limit. Raising the limit needs your explicit approval and is audited.
* **No automatic retries of paid calls.** A failed research job is re-run by you, so it
  is never billed twice silently.
* **Sample runs cost $0** and are excluded from spend.
* Unknown models (e.g. a fallback model with no price on file) are costed at the most
  expensive known rate, so recorded spend is never under-stated.

The full monthly cost report (voice, avatar, storage, hosting) is completed in Phase 10.
