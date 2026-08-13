---
tags: [status, crm-poc]
---

# STATUS

**Last updated: 2026-08-12.** This is a snapshot, not history — for how we got here, see `daily/` (or [[00-index]] for links to each entry); for why things were built the way they were, see [[06-decisions|Decision records]].

## Where the project stands

- **MVP complete.** All five customer stories (Add, View, Edit, Delete, Search) are built and verified, plus the reactivation-and-audit-trail extension raised mid-build: re-adding a soft-deleted customer's email reactivates that record (preserving history) instead of blocking or duplicating, and every create/deactivate/reactivate is logged to `customer_activities`.
- **Phases 1-5 of the build plan are done**: scaffold + database, backend (NestJS/TypeORM/MySQL), frontend (Next.js single-page landing UI with modals, per the user's own spec), testing, and SDLC documentation.
- **48 automated tests passing** (17 backend unit, 10 backend e2e, 21 frontend component), plus a 10-check live browser acceptance walkthrough covering every story end-to-end — all green. See [[05-test-plan|Test plan]] for what each layer covers and the four real bugs caught along the way.
- **Full documentation set** in `docs/`: requirements, architecture, ERD, sequence diagrams, test plan, 11 decision records, and a deferred Azure deployment runbook. All 8 Mermaid diagrams verified to actually render (`@mermaid-js/mermaid-cli`), not just look right in the editor.

## Next action (if resumed)

**Phase 6 (Azure deployment) is the only remaining phase, and it's deliberately deferred, not blocked.** See [[07-azure-deployment|Azure deployment]] for the ready-to-execute runbook (App Service F1, Static Web Apps, MySQL Flexible Server) and the free-tier cost caveat to read before running it: MySQL Flexible Server's free allowance is a 12-month new-account offer, not permanent.

Otherwise, there is no standing next action — the MVP is feature-complete and tested. Any further work is a new decision, not a continuation of a stalled task.

## Needs review / open items

- **The activity/audit trail has no UI yet** — it's backend/API only (`GET /api/customers/:id/activity`), by explicit choice for this phase. See [[01-requirements|Requirements]]'s extension section.
- **Automatic inactivity detection** (auto-set `status` to `INACTIVE` after N days) was raised and explicitly deferred — would need a `lastOrderAt`-style field the model doesn't have, plus a scheduled job or lazy at-read computation, neither of which exists.
- **No CI/CD pipeline** — all testing and any future deployment is manual (`npm test` / `npm run test:e2e` / `npm run test:web`, run by hand).
- **Obsidian vault hygiene**: `node_modules` (1,800+ npm-package `README.md` files) had to be filtered out of both the vault's file index and the Graph view's filter query, since Obsidian doesn't read `.gitignore`. Done for this vault; worth remembering if the vault is ever reopened fresh or the `.obsidian/` config is lost (it's gitignored, matching `undergrad_thesis`'s convention, so it won't survive a fresh clone).

## Related

- [[00-index]] — notes index
- [[01-requirements|Requirements]], [[05-test-plan|Test plan]], [[06-decisions|Decision records]], [[07-azure-deployment|Azure deployment]]
