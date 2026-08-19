---
tags: [presentation, crm-poc]
---

# Mentor presentation prep

**Format:** informal, no slides — live demo + talking points. **Time:** 15-20 min core, but expect the real conversation to run longer since the mentor is a senior engineer who'll probe. This doc has two parts: (1) a tight script for the time you have, (2) a reference section of likely deep questions with answers, since that second part is where the meeting will actually live.

Read [[design-and-architecture-principles]] first, not just as a reference to fall back on — it's the *reasoning* underneath every answer below. This doc tells you what to say; that one is why it's true. If a question comes up that isn't scripted here, that's the doc that lets you improvise instead of stalling.

## Before they sit down

- [ ] Both servers running already (`npm run dev:api`, `npm run dev:web`) — don't burn demo time booting things
- [ ] `crm_poc` reseeded clean right before the meeting: `cd apps/api && npm run seed` — resets to 30 known customers, 0 deleted, so the demo starts from a state you can predict. (Don't reseed *during* practice runs and forget to redo it — check the actual count first: `mysql -u root crm_poc -e "SELECT COUNT(*), SUM(deletedAt IS NOT NULL) FROM customers;"`)
- [ ] A terminal ready, `cd` into `apps/api`, with a `mysql -u root crm_poc` prompt or a quick `mysql -e "..."` command ready to paste — this is your proof layer, more convincing than the UI alone to a senior engineer
- [ ] Browser tabs ready: `localhost:3000` (the app), `github.com/garyhan77/mycrm-poc` (repo), and `docs/06-decisions.md` open locally (Obsidian or GitHub) in case they want to see an ADR
- [ ] Know your own numbers cold: **54 automated tests**, **12 ADRs**, **5 core stories + 1 extension**, **2 tables** (`customers`, `customer_activities`)

---

## The 15-20 minute flow

### 1. Framing (60-90 sec)

Say it plainly, don't undersell the scope decision:

> "This is a PoC CRM — customer operations only: add, view, edit, delete, search. I deliberately scoped it to one entity, no orders/products/auth, so I could take the full SDLC seriously on a small surface instead of doing a shallow pass on a big one. NestJS backend, Next.js frontend, MySQL, explicit MVC, versioned migrations, full test coverage, and the docs to back all of it up."

If they ask "why this scope" immediately: it forces every layer (requirements → architecture → ERD → tests → decision records) to actually get built properly instead of hand-waved, which was the point.

### 2. Architecture, fast (2 min)

Don't over-narrate — say the shape, point at [[02-architecture|the diagram]] if they want it, move on:

- Two services over HTTP/JSON: NestJS API (`:3001`) is Controller + Model, Next.js (`:3000`) is View. MySQL underneath.
- MVC mapping is literal, not aspirational — entity classes are the Model, one controller/service pair per resource, React components never touch the DB directly.
- One line on the framework choice, since it'll come up: "NestJS and Next.js so the whole stack is one language. .NET was on the table — I wrote up why I didn't take it, mainly to avoid a C#/TypeScript context switch for a project this size, not because it's wrong."
- Migrations, not `synchronize: true` — schema is versioned, not auto-guessed.

### 3. Live demo (7-8 min) — the core of the talk

Do these in order. Narrate what you're doing, not what the code does — let the app speak, save code narration for when they ask.

1. **Landing page** — point out: every column visible, click a header to sort (do it once, e.g. Last name), pagination bottom-right.
2. **Search** — type something, hit Search, show it filters. Clear the box, show it snaps back to the full list immediately (small thing, but it's a real bug you fixed — mention it in 5 seconds, don't dwell).
3. **Add, with validation** — click Add, hit submit blank. Point at the red-highlighted fields and inline messages. Fill it in, submit, watch it land in the table.
4. **Edit** — click the first name you just added, change something, save. Note out loud: "Add and Edit are the same modal — clicking a name opens it pre-filled. No separate view screen; the editable form doubles as view."
5. **Bulk delete** — check two rows, hit Delete selected, confirm. Gone from the table.
6. **The differentiator — reactivation.** This is your best material, spend real time here:
   - Add a customer with a company/notes filled in.
   - Delete them.
   - Switch to your terminal: `SELECT firstName, status, deletedAt FROM customers WHERE email = '...'` — show `status = INACTIVE`, `deletedAt` set, row still exists.
   - Back in the UI, re-add with the *same email*, only first/last name this time (leave company/notes blank).
   - Show it doesn't error, doesn't duplicate — same customer, new name, **but company/notes are still there** and status is back to whatever it was before deletion.
   - Say it plainly: "Re-adding a deleted customer's email reactivates the record instead of duplicating or blocking it. Only the fields you actually submit get overwritten — everything else survives the delete/reactivate cycle."
7. **Audit trail** — hit `GET /api/customers/:id/activity` in the browser or curl it. Show the `CREATED → DEACTIVATED → REACTIVATED` sequence with timestamps. "No UI for this yet, on purpose — it's there for accountability, not for this pass of the product."

### 4. Testing and the bugs it caught (2-3 min)

This is where a senior engineer's ears perk up. Don't just cite the count — cite what it *caught*:

> "54 automated tests across three layers — unit tests on the service with mocked repos, e2e tests over real HTTP against a real database, and frontend component tests. Plus a live browser walkthrough for the stuff that only breaks when the pieces run together."

Then pick **two** of these (don't list all six, you'll run out of time — but have all six ready if they ask "what else"):

- **Soft-delete + duplicate email → the code returned a raw 500, not a 409.** MySQL's unique index on `email` still counts soft-deleted rows; the first version of the check didn't account for that. Found in the browser, not by a test that was already written for it.
- **TypeORM's `softRemove()` silently drops unrelated field changes.** Built logic to force `status` to `INACTIVE` on delete, verified with `tsc --noEmit` and green unit tests, then checked the actual database directly — `deletedAt` was right, `status` hadn't moved. A mocked-repository test structurally can't catch that; only checking the real thing did.

Land it with: "The theme across all of these is: I didn't trust green tests or clean compiles as proof by themselves. Every non-trivial change got checked against the real running app and the real database before I called it done."

### 5. Docs and decision records (1-2 min)

> "Everything's reverse-documented from what actually shipped, not written speculatively upfront — requirements, architecture, ERD, sequence diagrams, test plan, and 12 decision records."

If there's a beat for it, pull up one ADR live — ADR-012 (the status/softRemove one) is the strongest, since it's the same story you just told in the demo, now written down with the trade-off made explicit.

### 6. Scope boundary (1 min)

Show the out-of-scope list is a decision, not a gap:

> "No auth, no orders/products, no .NET, no automatic inactivity detection, Azure deployment written up as a runbook but deliberately not executed — cost caveat and all. Every one of these got raised at some point and explicitly deferred, not missed."

### 7. Close (30 sec)

> "The point of this wasn't the CRM feature set — it's a small enough surface that I could run the full SDLC properly on it: real requirements, real architecture decisions with trade-offs written down, real test discipline, and I could actually verify every claim I'm making to you right now instead of asserting it."

Then stop talking. Let them drive.

---

## Reference: likely deep questions

Organized so you can find the right one fast mid-conversation, not so you read it top to bottom.

### Architecture / stack choices

**"Why NestJS over raw Express or Fastify?"**
Wanted the MVC split to be structural, not a convention I had to enforce by hand. NestJS's modules/controllers/services/DTOs map onto Model/Controller directly, and the decorator-based validation (`class-validator` + a global `ValidationPipe`) gives request validation almost for free. Trade-off: more ceremony (DI, modules) than a project this size strictly needs — accepted because the MVC-clarity goal was the point.

**"Why TypeORM over Prisma?"**
Entity classes double as the Model layer and generate the ERD almost directly from source. Prisma's schema-first + generated-client approach is arguably more polished DX, but it doesn't give me a literal class to point at and say "this is the Model." Cost: hit a couple of real TypeORM-specific gotchas (see the bug list) that Prisma might not have had.

**"Why MySQL, not Postgres?"**
No strong technical reason — it's what the brief pointed at, and it's a reasonable default for an e-commerce-adjacent CRM. Nothing in the schema depends on MySQL-specific features; Postgres would work with a driver swap and zero schema changes.

**"Why not .NET, since Azure's Microsoft's own stack?"**
Considered and written up (ADR-004). Chose to keep one language (TypeScript) across frontend and backend rather than context-switch into C# for a project this size. If this were a real .NET shop's system, that calculus flips.

**"Single-page app with modals instead of routed pages — why?"**
That's literally how it was specified partway through the build — I'd originally planned routed pages (`/customers/new`, `/customers/:id`), then got redirected to one landing page with popups. Cost I noted for the record: no bookmarkable/shareable URL per customer, and Next.js's actual routing capability goes almost unused. Documented as ADR-010, not silently absorbed.

### Data model

**"Why both `deletedAt` and `status`? Isn't that redundant?"**
They mean different things. `deletedAt` is the system's "is this record visible" flag — the app filters on it everywhere. `status` (LEAD/ACTIVE/INACTIVE) is a business classification the user sets, independent of deletion. They *were* out of sync until I caught it during testing: a deleted customer could still show `status = ACTIVE` in a raw query. Now delete forces `status → INACTIVE` and reactivation restores whatever it was, unless the form explicitly sets a new one.

**"How do you know reactivation restores the correct prior status, not just a default?"**
It's not inferred — it's read back from the audit log. Every delete writes a `DEACTIVATED` row to `customer_activities` with a `previousStatus` column capturing the exact value at that moment. Reactivation looks up the most recent `DEACTIVATED` row for that customer and restores from there. Verified three ways: a unit test with a mocked activity repo, an e2e test with a real delete→reactivate cycle against real MySQL, and a live curl+SQL check before I trusted either.

**"Why a separate `customer_activities` table instead of `deactivatedAt`/`reactivatedAt` columns?"**
A customer can cycle through delete/reactivate more than once. A pair of "last changed" columns only ever captures the most recent cycle; a table gives a full chronological trail. Cost: an extra join-adjacent lookup on reactivation instead of reading two columns directly.

**"What about real orders — `totalOrders`/`lifetimeValue` are just numbers?"**
Yes, deliberately. Single-entity scope decision (ADR-006) — no `Order` table. Those fields are static/manually-set, not computed. If order history mattered for real, that's the first schema change I'd make, and it'd unlock the auto-inactivity-detection idea that got raised and explicitly deferred.

### Testing

**"What's actual coverage?"**
100% statement, 93% branch on `CustomersService` specifically (the layer with the business logic). Controllers/DTOs sit at 0% in isolated unit coverage by design — they're exercised by the e2e suite instead, which hits real HTTP.

**"Why e2e tests against a real database instead of an in-memory one?"**
Wanted to catch exactly the class of bug that happened: MySQL-specific behavior (unique index still enforced on soft-deleted rows, `TRUNCATE` refusing a table with a live FK) that an in-memory or mocked substitute wouldn't reproduce.

**"Walk me through one bug in real detail."**
Pick the `softRemove()` one — it's the best story: wrote the logic to force status to INACTIVE, `tsc --noEmit` was clean, unit tests were green, felt done. Then ran it against the actual app and checked the database directly instead of trusting the test suite — `deletedAt` had updated, `status` hadn't moved at all. Root cause: TypeORM's `softRemove()` only persists the delete-date column, not other dirty fields on the same entity — that's an ORM implementation detail no mock has an opinion on, so no unit test could have caught it. Fixed with an explicit `save()` before `softRemove()`.

### Process / decisions

**"What would you do differently?"**
Two honest answers: (1) I'd nail down the frontend interaction model (routed pages vs. single-page-with-modals) *before* Phase 3 instead of mid-build — cost a partial rewrite of the planned page structure. (2) I'd add the activity-trail UI in the same pass as the backend instead of deferring it — the data's there, the panel isn't, and that's a visible gap in an otherwise complete story.

**"What's your branching/commit strategy?"**
Direct commits to `main`, one logical change per commit with a message explaining the *why*, not the diff. Reasonable for a solo PoC; in a team setting this would be feature branches plus PR review before merge, and I'd want CI gating on the test suite before that merge — which doesn't exist yet here (noted as a known gap).

**"How would this scale to 10,000 customers?"**
Pagination and sorting already happen at the SQL level (`LIMIT`/`OFFSET`, indexed columns), not in application memory, so the read path holds up reasonably. The `LIKE '%q%'` search would start to hurt — no full-text index yet, and a leading wildcard defeats a normal B-tree index anyway. That's the first thing I'd profile and fix before scale became a real problem.

**"Is this deployed anywhere?"**
Local only, on purpose (ADR-007). Azure deployment is fully written up as a ready-to-execute runbook — App Service F1, Static Web Apps, MySQL Flexible Server — including the cost caveat that the MySQL free tier is a 12-month new-account offer, not permanent. Didn't want to commit to a cost decision without flagging it explicitly.

---

## Related

- [[00-index]] — notes index
- [[design-and-architecture-principles]] — the *why* behind these answers, one level more abstract
- [[06-decisions|Decision records]] — the ADRs referenced throughout
- [[05-test-plan|Test plan]] — full bug list and test breakdown
- [[STATUS]] — current project snapshot
