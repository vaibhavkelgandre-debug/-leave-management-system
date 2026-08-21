# Deployment & Operations

> **What this is**: how this system actually runs in production, what it needs to be given, and what to check when it
> misbehaves. Everything here was learned by deploying it, mostly by things going wrong first.
>
> **Scope**: Render (two services + managed Postgres) and SendGrid. Nothing here describes local development — that's
> [`server/README.md`](../../server/README.md) and [`client/README.md`](../../client/README.md).

---

## Contents

| # | File | Covers |
|---|---|---|
| 01 | [Services & topology](01-services-and-topology.md) | the two services, how the frontend reaches the API, hibernation |
| 02 | [Environment variables](02-environment-variables.md) | every variable, which service it belongs to, what breaks without it |
| 03 | [Database & migrations](03-database-and-migrations.md) | the per-environment procedure, baselining, the replay trap |
| 04 | [Troubleshooting](04-troubleshooting.md) | symptom → cause, for every failure this deployment has actually produced |

## At a glance

```text
                 ┌─────────────────────────────┐
 browser ───────▶│ Static Site (client build)   │
                 │  Vite output, /api/* rewrite │
                 └──────────────┬───────────────┘
                                │  /api/*
                                ▼
                 ┌─────────────────────────────┐
                 │ Web Service (server)         │
                 │  node src/server.js          │
                 └───────┬─────────────┬────────┘
                         │             │ HTTPS 443
                         ▼             ▼
              ┌────────────────┐  ┌──────────────┐
              │ Managed Postgres│  │ SendGrid API │
              └────────────────┘  └──────────────┘
                                     │
                                     ▼  (also Cloudinary, for documents)
```

## The three things that have actually broken

Each has a full entry in [04-troubleshooting.md](04-troubleshooting.md); they're listed here because they're the
failure modes this topology *invites*, and any future operator will meet them.

1. **Split-deploy skew.** Two services deploy independently, so the frontend can run a build ahead of the backend. The
   symptom is `404` and `422` on endpoints that exist in the repo — indistinguishable from broken features. **Deploy
   the backend first.**
2. **SMTP is blocked outbound.** Ports 587 and 465 both time out. Mail goes over HTTPS to SendGrid instead, and no
   amount of SMTP configuration will change this.
3. **Migrations don't run themselves.** Deliberately. A deploy never touches the schema; someone runs the migration
   command against each environment.

## The rule that matters most

**Environment variables are read from the process environment, so saving one in the dashboard does nothing until the
service restarts.** Render normally redeploys on save — confirm that it did. A variable that's set but not live is the
single most misleading state this system can be in, because the dashboard shows it as correct.
