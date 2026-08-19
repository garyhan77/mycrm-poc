---
tags: [presentation, crm-poc, architecture]
---

# Design & architecture: what makes this good engineering

Companion to [[mentor-presentation]]. That doc is *what to say*. This one is *why it's actually good* — the underlying principles, so you can explain any part of this system in your own words under real questioning, not just recite prepared lines. If you understand the eight ideas below, you can defend or extend almost anything a senior engineer asks about this project, even the parts that aren't scripted.

Each one follows the same shape: **the trait** → **the failure mode it prevents** → **where it's real in this codebase** → **a sentence you could say that proves you understand it, not just remember it**.

---

## 1. Separation of concerns — layers that can't reach into each other

**The failure mode it prevents:** a system where a change anywhere breaks something everywhere, because nothing has a clean boundary. Classic symptom: a frontend component that queries the database directly, or business logic scattered across controllers, making the codebase impossible to reason about in isolation.

**Where it's real here:** the MVC split isn't a naming convention, it's enforced structurally. `CustomersController` does routing and validation and *nothing else* — no business logic lives there. `CustomersService` owns every rule (duplicate-email checks, the reactivation branching, activity logging). The Next.js frontend never touches MySQL; every read and write goes through `lib/api.ts`, a typed HTTP client. You could swap MySQL for Postgres and touch zero frontend code. You could replace the Next.js frontend with a mobile app and touch zero backend code, because the boundary between them is a plain HTTP/JSON contract.

**Say this:** "Each layer has exactly one job, and the boundaries are load-bearing — I can reason about the service layer's business rules without knowing anything about how the UI renders them, because nothing crosses that line."

---

## 2. Designing for reversibility and real-world messiness

**The failure mode it prevents:** software that only models the happy path. Real users make mistakes, change their minds, delete the wrong thing, come back six months later wanting the same customer back. A system that only handles "create" and "permanently gone" is modeling a fantasy, not a business.

**Where it's real here:** delete is soft (`deletedAt`, not a SQL `DELETE`) — a mistake is recoverable. Re-adding a deleted customer's email doesn't error and doesn't duplicate — it reactivates the same record, because a real business relationship with that person didn't actually end, it paused. And because a customer can pause and resume more than once, there's a full event log (`customer_activities`: CREATED / DEACTIVATED / REACTIVATED), not just a "last changed" timestamp that would only remember the most recent cycle.

**Say this:** "I tried to model what actually happens to a customer relationship over time, not just the CRUD operations — delete isn't an ending, it's a state, and the system remembers the whole history of that state changing."

---

## 3. Defense in depth — not trusting any single layer to be right

**The failure mode it prevents:** a bug that only exists because you assumed one layer (usually the one you wrote most recently) was correct, and nothing else double-checked it. This is exactly how the two most interesting bugs in this project happened, and exactly how they got caught.

**Where it's real here:** two concrete places.
- **The email-uniqueness rule is enforced twice, on purpose**: once in the application layer (`assertEmailIsAvailable`, for a clean 409 response) and once at the database level (a real `UNIQUE` index on `email`). The app-level check alone has a race condition — two near-simultaneous requests could both pass it before either commits. The DB constraint is the actual source of truth; the app check is just there to make the failure mode pleasant (409, not a raw SQL error).
- **Testing is layered on purpose, not just "more tests are better."** Unit tests (mocked repositories) verify logic in isolation, fast. E2e tests verify the real HTTP → real database path. Frontend tests verify the UI actually reflects state correctly. And manual verification against the real running app exists specifically because it's the only layer that can catch an ORM behaving unexpectedly — which is exactly what happened: `softRemove()` silently only persisting the delete-date column was invisible to every mocked unit test (the mock has no opinion on what a real `softRemove()` does), and only showed up when I checked the actual database after the actual call.

**Say this:** "I don't trust any one layer to be the only thing standing between the system and a bad state — the database enforces the same constraint the app already checks, and my test strategy exists specifically because different layers catch different classes of bug, not as a checkbox."

---

## 4. Schema as a versioned artifact, not a moving target

**The failure mode it prevents:** "works on my machine" schema drift — a database whose actual shape nobody can reconstruct, because it was hand-edited or auto-synced into its current state through months of ad hoc changes. This is a real, common cause of production outages: a deploy assumes a column exists that only exists on the developer's laptop.

**Where it's real here:** `synchronize: false`, everywhere, on purpose. Every schema change is a migration file, checked into git, with an explicit `up`/`down`. There are two of them in this project (`InitCustomers`, `AddCustomerActivities`, plus one more for the `previousStatus` column) — each one is a reviewable, revertible, ordered record of how the schema got to its current shape, runnable identically on any machine, any time.

**Say this:** "The schema has a history I can replay, the same way the code does — nobody has to guess what the database looks like, they can read the migrations and know."

---

## 5. Verifying reality, not trusting a green checkmark

**The failure mode it prevents:** shipping something that *looks* done — compiles, passes tests, matches the spec on paper — but doesn't actually behave correctly when it runs for real. This is the single most common gap between a junior and a senior engineer: the junior stops at "the tests pass," the senior asks "did I actually check what happens."

**Where it's real here — this is your best material, because it happened twice, in two different ways:**
- Built the status-restore logic, `tsc --noEmit` was clean, unit tests were green. Checked the real database directly anyway (`SELECT status, deletedAt FROM customers WHERE id = ...`) and found `status` hadn't actually changed, despite the code clearly setting it. That's the `softRemove()` bug — invisible to every automated layer, caught only by looking at the real thing.
- Earlier, the same instinct caught a soft-deleted customer's email causing a raw `500` instead of a clean `409` — found by clicking through the actual running app, before a test existed for that path at all.

**Say this:** "Passing tests told me the code did what I told it to do. Checking the real database told me whether what I told it to do was actually correct. Those aren't the same question, and I try not to conflate them."

---

## 6. Deliberate scope control — knowing what *not* to build, and why

**The failure mode it prevents:** two opposite failure modes, actually — scope creep (building things nobody asked for, at the cost of finishing what was asked) and silent gaps (missing things nobody decided to skip, they just didn't get done, and nobody can tell the difference from the outside).

**Where it's real here:** every out-of-scope item has a *reason*, not just an absence. No authentication — deliberate, to keep the PoC's surface area focused on customer operations. No `Order`/`Product` entities — deliberate (ADR-006), so the ERD, tests, and every layer stay focused on what the five stories actually need. Automatic inactivity detection was *raised explicitly*, discussed, and *deferred* with the reason on record (needs a `lastOrderAt` field and a scheduler that don't exist yet) — it's not a gap, it's a decision. Azure deployment is fully written up as a runbook and deliberately not executed, with the cost caveat stated plainly (the MySQL free tier is a 12-month offer, not permanent) rather than just... not thinking about cost.

**Say this:** "Every one of these boundaries is something I considered and consciously drew the line on, not something I ran out of time for — and I can tell you the reason for each one, which is different from having an excuse for each one."

---

## 7. Decisions as documented trade-offs, not just choices

**The failure mode it prevents:** a codebase where nobody — including future-you — can tell whether a choice was load-bearing or accidental. Six months later, "why does it work this way?" has no answer, so nobody feels safe changing it, and cruft accumulates because touching anything feels risky.

**Where it's real here:** 12 ADRs, each with the same shape — context (what was true when the decision got made), decision (what was chosen), consequences (what it costs, not just what it gains). ADR-012 is the clearest example: it doesn't just say "delete sets status to INACTIVE," it says *why* (a raw query on `status` alone was misleading without also checking `deletedAt`), what the fix costs (reactivation needs an extra lookup; a customer deleted before this shipped has no recorded prior status), and the real bug that surfaced while building it. A trade-off with no downside written down isn't a trade-off, it's a sales pitch.

**Say this:** "I tried to write these so that revisiting a decision later is a matter of reading why, not re-deriving it from scratch — and every one of them names a real cost, not just a benefit, because a decision that has no downside probably wasn't examined closely enough."

---

## 8. Designing extension points without building them prematurely

**The failure mode it prevents:** two more opposite failure modes — over-engineering (building abstraction for hypothetical futures that may never arrive, at real cost to the present) and painting yourself into a corner (building so narrowly that the obvious next feature requires a rewrite).

**Where it's real here:** the architecture doc names exactly where auth would attach (a Nest guard in front of the controller), where orders would attach (a new entity with a relation to `Customer`, following the same pattern `CustomerActivity` already establishes), and what automatic inactivity detection actually needs that doesn't exist yet (a `lastOrderAt`-shaped field, a scheduler). None of these are built. All of them are *known* — the seams are identified without being speculatively constructed. That's the difference between "I thought about how this grows" and "I built a framework for growth nobody asked for yet."

**Say this:** "I know where the next three features would go without having built speculative scaffolding for any of them — the architecture doesn't block them, but it also doesn't pretend to solve problems I don't have yet."

---

## How to use this in the room

Don't recite these eight as a list — that's the opposite of the point. If your mentor asks *any* question, reach for the underlying trait first, then the specific evidence. "Why soft delete?" isn't really a question about `deletedAt` — it's trait #2. "Why two testing layers?" isn't really about test counts — it's trait #3. If you can hear the trait underneath their question, you'll always have something real to say, even about a part of the system that isn't in your rehearsed demo.

The single strongest thing you can do in this meeting is answer a question you didn't prepare for by reasoning from these principles instead of freezing. That's the actual trait being evaluated — not whether you memorized the ERD.

## Related

- [[mentor-presentation]] — the demo flow and specific Q&A this feeds into
- [[06-decisions|Decision records]] — the ADRs referenced throughout
- [[STATUS]] — current project snapshot
