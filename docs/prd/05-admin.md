# PRD: admin panel (saas mode)

For the operator, not the end user. Enabled only when `GENNY_MODE=saas` and the
actor's role is `admin`, checked server-side with RLS as the second line.

## Surfaces

| Surface | Answers |
|---|---|
| Catalog | What do we offer, at what price, in what order? What is each model's real input schema? |
| Jobs | What is running, what failed, why, and what did it cost? |
| Users | Who is here, what plan, what balance, what did they spend it on? |
| Credits | Grant, adjust, and see the ledger behind a balance |
| Flags | Turn a feature on for a subset without a deploy |

## Requirements

| # | Requirement |
|---|---|
| AD1 | Enable, disable, reorder and re-price a model without a deploy |
| AD2 | Every model's input schema and price are visible without leaving the panel |
| AD3 | A job can be inspected, retried, or refunded, and each action is audited |
| AD4 | A credit adjustment writes a ledger row with the admin's identity and a note |
| AD5 | A non-admin gets 404, not 403: the panel's existence is not advertised |
| AD6 | Every mutation is rate limited and logged |
| AD7 | Catalog drift between file and table is shown, per model |

## Out of scope

Analytics dashboards, cohort reports, impersonation, a permission matrix. One
admin role until there is a reason for two.
