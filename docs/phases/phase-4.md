# Phase 4: admin panel

**Milestone:** M4 · **Mode:** saas

The job: an operator runs the business without a deploy.

## Scope

- Catalog: enable, disable, reorder, re-price, inspect live input schemas
- Catalog drift: which models differ from their file, and how
- Jobs: inspect, retry, refund, with an audit trail
- Users: plan, balance, spend history, role
- Credits: grant and adjust, always as a ledger row with an author and a note
- Feature flags

## Exit criteria

| # | Criterion |
|---|---|
| 4.1 | Re-pricing a model changes the next generation's cost with no deploy |
| 4.2 | Every model's real input schema is visible in the panel |
| 4.3 | A refund from the panel writes a ledger row and is visible to the user |
| 4.4 | A non-admin gets 404, and RLS blocks the query even if the route is reached |
| 4.5 | Every mutation is audited with actor, timestamp and before/after |
| 4.6 | Catalog drift is listed per model |

## Out of scope

Analytics dashboards, impersonation, a permission matrix.
