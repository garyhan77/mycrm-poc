# Decision Records

Lightweight ADRs (Architecture Decision Records) for the choices made building MyCRM, in the order they came up. Each records the context at the time, what was decided, and the trade-off accepted.

---

## ADR-001: NestJS for the backend API

**Context.** Needed a Node.js backend framework with structure suited to an explicit MVC split, and a language shared with the frontend.

**Decision.** NestJS, with TypeScript throughout.

**Consequences.** NestJS's modules/controllers/services/DTOs map directly onto the Controller and Model layers, and its decorator-based validation (`class-validator` + a global `ValidationPipe`) gave request validation almost for free. The trade-off: more ceremony (modules, dependency injection) than a minimal Express app would need for a project this small, accepted because the MVC-clarity goal outweighs the extra boilerplate.

---

## ADR-002: Next.js for the frontend

**Context.** Needed a React-based frontend, in the same language as the backend.

**Decision.** Next.js (App Router), even though the eventual UI turned out to be a single page with no routing — see ADR-010.

**Consequences.** Got TypeScript, Tailwind, and a dev server with fast refresh out of the box via `create-next-app`. The App Router's file-based routing ended up almost entirely unused (one `app/page.tsx`), which is a mismatch between the framework's strength and this app's shape, but switching to a lighter tool (plain Vite + React) wasn't worth the churn partway through the build.

---

## ADR-003: TypeORM over Prisma

**Context.** Needed an ORM/query layer for the Model.

**Decision.** TypeORM.

**Consequences.** Decorator-based entity classes (`@Entity`, `@Column`) double as living documentation of the schema and generate the ERD in [[03-erd|ERD]] almost directly. TypeORM's migration CLI (`typeorm-ts-node-commonjs`) versions the schema instead of relying on `synchronize: true`. The cost: a less polished developer experience than Prisma's generated client and schema-first workflow, and a couple of TypeORM-specific gotchas hit during the build (see [[05-test-plan|Test plan]]'s bug log: the `undefined`-vs-`null` behaviour on save, and MySQL's `TRUNCATE`-with-FK restriction).

---

## ADR-004: .NET evaluated, not adopted

**Context.** The original project brief named .NET as a stack to evaluate.

**Decision.** Not adopted for this PoC. NestJS (ADR-001) was used instead.

**Consequences.** .NET (ASP.NET Core + Entity Framework Core, C#) is a legitimate alternative, particularly given Azure's Microsoft lineage (relevant to [[07-azure-deployment|Azure deployment]]) and common enterprise .NET-shop environments. It was set aside specifically to keep the whole stack in one language (TypeScript, matching Next.js), avoiding a context-switch between C# on the backend and TypeScript on the frontend for a project this size. Recorded here as a deliberate choice, not an oversight.

---

## ADR-005: Soft delete for customers

**Context.** The Delete story needed a decision: physically remove the row, or mark it removed?

**Decision.** Soft delete via TypeORM's `@DeleteDateColumn` (`deletedAt`). `DELETE` requests never issue a SQL `DELETE`.

**Consequences.** A CRM shouldn't lose customer history to an accidental or later-regretted delete, and this single decorator is what makes the reactivation extension (ADR-008) possible at all. The cost: every query implicitly needs to be soft-delete-aware, and this is exactly what caused the [[05-test-plan|duplicate-email 500 bug]] — the unique index on `email` still counts soft-deleted rows, which the first version of the duplicate-email check didn't account for.

---

## ADR-006: Single-entity data model scope

**Context.** "CRM for digital/e-commerce" invites an `Order`/`Product`/`OrderItem` schema, but the stated stories are all about customers.

**Decision.** One business entity, `Customer`, with e-commerce context carried as denormalized fields (`totalOrders`, `lifetimeValue`) rather than real order records. `customer_activities` (ADR-009) is a supporting table, not a second business entity.

**Consequences.** Keeps the ERD, seed data, and every layer of testing focused on what the stories actually need. The explicit cost: `totalOrders` and `lifetimeValue` are static/manually-set fields, not computed from real orders, and any feature that needs real order history (e.g. the automatic-inactivity idea raised and deferred, see [[01-requirements|Requirements]]) is out of reach until this scope is revisited.

---

## ADR-007: Local-first hosting, Azure deferred

**Context.** Azure was raised as a hosting option, conditional on being free.

**Decision.** Build and run entirely locally (Homebrew MySQL, two `npm run dev` processes) for this phase. Azure is documented as a ready-to-execute plan in [[07-azure-deployment|Azure deployment]], not executed.

**Consequences.** Zero cost risk and zero Azure-account setup blocking development. The explicit cost recorded in that doc: Azure Database for MySQL's free allowance is a 12-month new-account offer, not permanently free, so deploying later needs that caveat surfaced before committing to it.

---

## ADR-008: Reactivation instead of duplicate-or-blocked on re-add

**Context.** Raised mid-build: what should happen when someone re-adds a customer using the email of someone previously deleted? The two obvious defaults (silently create a second record, ignoring the unique constraint's real-world meaning; or just block with `409` forever) both lose information a real CRM user would want.

**Decision.** Re-adding with a soft-deleted customer's email reactivates that record: same id, original `createdAt`, only the newly-submitted fields applied, everything else preserved. A true duplicate (active customer) still `409`s.

**Consequences.** This is the more useful real-world behaviour, but it changes what `POST /api/customers` means: it's no longer a pure create, it's a conditional upsert. That's a deviation from strict REST semantics, accepted because the alternative (a separate reactivate-specific endpoint) would be more ceremony for a PoC without a clear payoff. The merge-only-submitted-fields logic was itself the source of a subtle bug (see [[05-test-plan|Test plan]]) caused by a TypeScript compilation detail, not a design flaw in the decision itself.

---

## ADR-009: A dedicated activity-log table, not timestamp columns

**Context.** Needed to satisfy "audit initial creation, deactivated, and reactivated" from the reactivation discussion. A customer can cycle through delete/reactivate more than once.

**Decision.** `customer_activities` (id, `customerId` FK, `type` enum, `occurredAt`), one row per event, rather than `deactivatedAt`/`reactivatedAt` columns on `Customer`.

**Consequences.** A full chronological history survives any number of delete/reactivate cycles; a pair of "last changed" columns would only ever capture the most recent cycle. The cost is a second table and a join-adjacent query for `GET /api/customers/:id/activity`, and MySQL's refusal to `TRUNCATE` a table referenced by any FK (regardless of row count) meant the seed script had to change from `repo.clear()` to an explicit FK-checks-disabled truncate.

---

## ADR-010: Single landing page with modals, not routed sub-pages

**Context.** The original Phase 3 plan sketched routed pages (`/customers`, `/customers/new`, `/customers/[id]`, `/customers/[id]/edit`). The user then specified, unprompted, a single-page design: one landing page, search/table/pagination, Add and Edit sharing one popup form.

**Decision.** Built to the user's spec: `app/page.tsx` is the only route; `CustomerFormModal` handles both Add (empty) and Edit/View (pre-filled) as one component. "Popup" was interpreted as an in-page modal dialog, not a new browser window.

**Consequences.** Simpler mental model, fewer files, and it matches how the UI is actually used (see [[04-sequence-diagrams|Sequence diagrams]]'s View diagram: clicking a first name opens the modal from already-loaded table data, no extra request). The cost: Next.js's routing capability goes almost entirely unused (ADR-002), and there's no shareable/bookmarkable URL for a specific customer, which a routed `/customers/[id]` would have given for free.

---

## ADR-011: A dedicated bulk-delete endpoint, not N sequential requests

**Context.** The checkbox-based multi-select delete could have been implemented client-side as a loop of individual `DELETE /api/customers/:id` calls.

**Decision.** Added `DELETE /api/customers` accepting `{ ids: number[] }`, soft-removing all of them (and logging one `DEACTIVATED` activity each) in one request.

**Consequences.** One network round-trip instead of N, and one place (`removeMany`) to own the "soft-remove plus log" logic instead of relying on the frontend to fire N well-formed requests. The cost: it's an addition to the API surface made after Phase 2 had already been reviewed and committed, documented here rather than silently folded in.
