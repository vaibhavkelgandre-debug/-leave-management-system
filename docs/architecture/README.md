# Architecture & Workflow Reference

> **Purpose**: re-learn this codebase months later without re-reading every file — how it's built, how each
> workflow executes end to end, what's tested, and how to defend every design decision.
>
> **Source-of-truth ranking**: if this disagrees with the code, the code wins. If it disagrees with the
> spec-level docs ([requirements](../1.functional_requirements/README.md),
> [API](../2.api_documentation/README.md), [schema](../3.db/README.md),
> [NFRs](../4.non_functional_requirements.md), [rules](../../.claude/rules.md)), those win — this is the
> code-level companion, adding *how it's implemented* rather than a competing account of *what it should do*.

---

| File | Covers |
|---|---|
| [01-overview-and-structure.md](01-overview-and-structure.md) | what the system does, the stack, the folder map, architecture classification |
| [02-frontend-and-backend.md](02-frontend-and-backend.md) | React/Vite structure, the Express layering, the database access pattern |
| [03-auth-and-authorization.md](03-auth-and-authorization.md) | the three login paths, the four roles, where each gate is enforced |
| [04-workflow-onboarding-and-verification.md](04-workflow-onboarding-and-verification.md) | **trace** — invite → accept → profile → documents → HR verifies |
| [05-workflow-leave-and-reporting.md](05-workflow-leave-and-reporting.md) | **trace** — module index, applying for leave, decisions, HR CSV reporting |
| [06-workflow-payroll-and-notifications.md](06-workflow-payroll-and-notifications.md) | **trace** — payroll run, payslips, notifications, outbound email |
| [07-errors-api-and-function-map.md](07-errors-api-and-function-map.md) | error handling, the endpoint map, which function lives where |
| [08-testing-rules-and-data-flows.md](08-testing-rules-and-data-flows.md) | what's tested, business rules extracted from code, key data flows |
| [09-interview-debugging-and-impact.md](09-interview-debugging-and-impact.md) | questions and answers, a debugging guide, the change-impact map |
| [10-performance-execution-and-cheatsheet.md](10-performance-execution-and-cheatsheet.md) | performance review, strengths/weaknesses, one full request traced, cheat sheet |

## Shortcuts

- **Five minutes?** [01](01-overview-and-structure.md), then the execution example in [10](10-performance-execution-and-cheatsheet.md).
- **About to change something?** [09](09-interview-debugging-and-impact.md) maps a change in one layer to
  everything downstream that has to change with it.
- **Security specifically?** [`docs/9.security/`](../9.security/README.md) — it moved out of here.
- **Demoing?** [`docs/6.demo_walkthrough/`](../6.demo_walkthrough/README.md).
