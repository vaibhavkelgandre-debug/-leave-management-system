# Architecture & Workflow Reference

> **Purpose**: re-learn this codebase months later without re-reading every file — how it's built, how each
> workflow executes end to end, what's tested, what isn't, and how to defend every design decision.
>
> **Source-of-truth ranking**: if this reference disagrees with the code, the code wins. If it disagrees with
> [`1.functional_requirements.md`](../1.functional_requirements.md), [`2.api_documentation.md`](../2.api_documentation.md),
> [`3.db.md`](../3.db.md), [`4.non_functional_requirements.md`](../4.non_functional_requirements.md) or
> [`.claude/rules.md`](../../.claude/rules.md), those are the authoritative spec-level docs and this is the
> code-level companion to them — it adds *how it's implemented*, not a competing account of *what it should do*.
>
> **Why a folder rather than one file**: no document in this repo may exceed 400 lines (see the Documentation
> section of `.claude/rules.md`). A 1,600-line reference is unreviewable in a diff and unreadable on a phone;
> split by concern, each file is one sitting.

---

## Read in this order

| # | File | Covers |
|---|---|---|
| 01 | [01-overview-and-stack.md](01-overview-and-stack.md) | Project overview & technology stack |
| 02 | [02-structure-and-classification.md](02-structure-and-classification.md) | Folder structure & architecture classification |
| 03 | [03-frontend.md](03-frontend.md) | Frontend architecture |
| 04 | [04-backend-and-database.md](04-backend-and-database.md) | Backend & database architecture |
| 05 | [05-auth-and-authorization.md](05-auth-and-authorization.md) | Authentication & authorization flow |
| 06 | [06-workflow-index.md](06-workflow-index.md) | Module workflows — index, and HR reporting/CSV |
| 07 | [07-workflow-employee-onboarding.md](07-workflow-employee-onboarding.md) | Workflow — adding a new employee |
| 08 | [08-workflow-documents-and-verification.md](08-workflow-documents-and-verification.md) | Workflow — document upload & profile verification |
| 09 | [09-workflow-leave-application.md](09-workflow-leave-application.md) | Workflow — applying for leave |
| 10 | [10-workflow-leave-decisions.md](10-workflow-leave-decisions.md) | Workflow — approve / reject / override / withdraw / cancel |
| 11 | [11-workflow-payroll-and-payslips.md](11-workflow-payroll-and-payslips.md) | Workflow — payroll run & payslips |
| 12 | [12-workflow-notifications-and-email.md](12-workflow-notifications-and-email.md) | Workflow — notifications & outbound email |
| 13 | [13-errors-and-api-map.md](13-errors-and-api-map.md) | Error handling & API documentation map |
| 14 | [14-function-map.md](14-function-map.md) | Function map, by module |
| 15 | [15-testing.md](15-testing.md) | Testing — covered, missing, and traced to code |
| 16 | [16-business-rules-and-data-flows.md](16-business-rules-and-data-flows.md) | Business rules & important data flows |
| 17 | [17-interview-reference.md](17-interview-reference.md) | Interview questions & rapid reference |
| 18 | [18-debugging-and-change-impact.md](18-debugging-and-change-impact.md) | Debugging guide & code-change impact map |
| 19 | [19-reviews.md](19-reviews.md) | Security, performance, strengths & weaknesses |
| 20 | [20-execution-example-and-cheatsheet.md](20-execution-example-and-cheatsheet.md) | Complete execution example & cheat sheet |

---

## If you have five minutes

Read [01-overview-and-stack.md](01-overview-and-stack.md) and
[20-execution-example-and-cheatsheet.md](20-execution-example-and-cheatsheet.md). Between them you get what the
system does, what it's built from, and one request traced from click to database and back.

## If you are about to change something

Read [18-debugging-and-change-impact.md](18-debugging-and-change-impact.md) first — it maps a change in one layer
to everything downstream that has to change with it.

## If you are demoing this

Use [`docs/6.demo_walkthrough/`](../6.demo_walkthrough/README.md) instead. This reference is organised by concern;
the walkthrough is organised as a narrative in presentation order.
