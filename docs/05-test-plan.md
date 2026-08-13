# Test Plan

## Strategy

Four layers, each catching a different class of bug; all four found real issues during the build (noted per layer below, not hypothetically):

1. **Backend unit tests** — `CustomersService` in isolation, both TypeORM repositories mocked. Fast, precise on business-rule branches (conflict vs. reactivate vs. fresh create, not-found paths).
2. **Backend e2e tests** — a real NestJS app over real HTTP against a dedicated database (`crm_poc_test`), exercising the full controller → service → TypeORM → MySQL path, including status codes.
3. **Frontend component tests** — React Testing Library against `CustomerFormModal`, `CustomerTable`, and the landing page, with `lib/api.ts` mocked. Catches UI-layer bugs (validation display, accessible labelling) that pass at the API level but break in the browser.
4. **Manual/browser acceptance** — a Playwright-driven walkthrough of the whole running application (both dev servers, real MySQL), plus targeted live verification (browser and direct SQL) as specific behaviors were built, because passing automated suites in isolation doesn't prove the pieces work *together*, and can't catch ORM/persistence-layer quirks a mock has no opinion on. This is the layer that caught most of the bugs below, including the two no other layer could have.

## Backend unit tests

**File:** [`apps/api/src/customers/customers.service.spec.ts`](../apps/api/src/customers/customers.service.spec.ts) — 20 tests, all passing. 100% statement coverage / 93% branch coverage on `CustomersService`.

| Area | Cases |
|---|---|
| `create` | fresh insert logs `CREATED`; active-duplicate email → `ConflictException`; soft-deleted email → reactivation merging only submitted fields; restores the pre-delete status from the last `DEACTIVATED` activity; defaults to `LEAD` when no prior status is recorded; an explicitly submitted status overrides the restored one |
| `findAll` | search/status/sort/pagination query building; defaults when the query is empty |
| `findOne` | returns customer; `NotFoundException` for unknown id |
| `update` | merges dto onto existing; skips the email-availability check when email is unchanged; `ConflictException` when changing to an in-use email |
| `remove` / `removeMany` | forces `status` to `INACTIVE`, persists it via an explicit `save()` (see the bug log below), soft-removes, and logs `DEACTIVATED` with the prior status; `NotFoundException` / no-op for unknown ids |
| `getActivity` | chronological order; works for soft-deleted customers; `NotFoundException` for an id that never existed |

Run: `npm test` in `apps/api` (or `npm run test:api` from the repo root).

## Backend e2e tests

**File:** [`apps/api/test/customers.e2e-spec.ts`](../apps/api/test/customers.e2e-spec.ts) — 12 tests, all passing, against `crm_poc_test` (truncated before each test).

| Area | Cases |
|---|---|
| Full lifecycle | create → view → search → edit → delete → confirm 404 and search-invisibility |
| Validation and conflicts | `400` on an invalid payload; `409` on a duplicate active email; `404` on an unknown id for view/edit/delete |
| Bulk delete | soft-deletes selected ids, leaves the rest; `400` on an empty `ids` array |
| Reactivation and audit trail | `CREATED` → `DEACTIVATED` → `REACTIVATED` sequence with preserved fields; a still-active duplicate email still `409`s; `404` for activity on an id that never existed; delete forces `status` to `INACTIVE` and records it on the `DEACTIVATED` activity, reactivation restores it; an explicitly submitted status on re-add overrides the restored one |

Run: `npm run test:e2e` in `apps/api` (or `npm run test:api:e2e` from the repo root).

## Frontend tests

**Files:** [`CustomerFormModal.test.tsx`](../apps/web/components/CustomerFormModal.test.tsx), [`CustomerTable.test.tsx`](../apps/web/components/CustomerTable.test.tsx), [`page.test.tsx`](../apps/web/app/page.test.tsx) — 22 tests, all passing.

| Area | Cases |
|---|---|
| Form (add/edit rendering) | empty form in add mode; pre-filled form in edit mode |
| Form (validation) | blank required fields show a message under each field, in red, with `aria-invalid`; only actually-blank fields are flagged; typing clears that field's error |
| Form (submission) | successful add calls `createCustomer`; successful edit calls `updateCustomer` (not create); a `409` from the API shows the server message and does not close the modal; Cancel calls `onClose` |
| Table | renders rows; loading and empty states; clicking a header calls `onSortChange` with the right column and shows the sort arrow; select-all and per-row checkboxes call their handlers; clicking a first name calls `onEditCustomer` |
| Landing page | loads customers with default params on mount; searching resets to page 1 and passes the query through; clearing the search box immediately reverts to the full list without needing another Search click; Add button opens the modal |

Run: `npm test` in `apps/web` (or `npm run test:web` from the repo root).

## Manual/browser acceptance walkthrough

A Playwright script drove the real running application (both dev servers, real MySQL, seeded data) through every MVP story in one continuous session, asserting on the actual rendered DOM rather than just taking screenshots. 10/10 passed, zero browser console errors.

| # | Check |
|---|---|
| 1 | Landing page loads: `MyCRM` header, 30 seeded customers |
| 2 | Search filters results |
| 3 | Sorting by a column reorders the table |
| 4 | Pagination advances and returns correctly |
| 5 | Add form: blank required fields get the red highlight + message |
| 6 | Add creates a new customer |
| 7 | New customer is findable via search |
| 8 | Edit persists a change |
| 9 | Checkbox selection + bulk delete removes the row |
| 10 | Re-adding a deleted customer's email reactivates the record, applying new fields and preserving fields left blank |

Followed by direct API checks: the reactivated customer's activity trail reads `CREATED → DEACTIVATED → REACTIVATED` in order, and every error path returns the documented status code (`400` invalid create, `400` empty bulk-delete, `404` unknown id, `404` activity for an unknown id, `409` true duplicate).

Two further behaviors were verified live against the running dev app and MySQL directly, outside the original 10-check script, at the point they were built (not retrofitted into it): the search-box-clear fix (typed a query, searched, cleared the box, confirmed the list reset without another Search click) and the delete/reactivate status-restore fix (created a customer with `status: ACTIVE`, deleted it, confirmed via direct SQL that `status` read `INACTIVE` — this is exactly what caught the `softRemove()` bug below — then reactivated it and confirmed `status` read `ACTIVE` again, with the `DEACTIVATED` activity row's `previousStatus` correctly recorded as `ACTIVE` throughout).

## Bugs this test plan actually caught

Recorded because they're evidence the layers are doing their job, not just green checkmarks:

1. **Soft-deleted email caused a raw `500`, not a clean `409`.** Found manually in the browser during Phase 3, before the reactivation feature existed. `assertEmailIsAvailable` only checked non-deleted rows, but MySQL's unique index on `email` still counts soft-deleted rows. Fixed with `withDeleted: true`.
2. **Reactivation silently corrupted the API response** (not the database). Found while building the reactivation feature: `CreateCustomerDto`'s optional fields compile to real own properties initialized to `undefined` (this project's ES2023 TS target implies `useDefineForClassFields`), so a naive `Object.assign(existing, dto)` overwrote every blank field with `undefined`. TypeORM correctly skipped those columns in the SQL `UPDATE`, but coerced them to `null` on the object handed back to the caller — so the database was right and the response lied about it. Fixed by merging only `dto`'s defined-value entries.
3. **The custom validation message was dead code for the fully-blank case.** Found while writing the frontend unit test for it: the required inputs also had a native HTML `required` attribute, which blocks form submission (and the `onSubmit` handler) before the app's own JS validation ever ran. Fixed by removing `required` so the app's own validation is the only validation path — which is also what made the later per-field red-highlight redesign possible to build and test cleanly.
4. **The per-field error message broke the input's accessible label** when first implemented. Found immediately by the new RTL test: the error text was rendered inside the `<label>` element, so once an error appeared, `getByLabelText('First name *')` no longer matched (the label's computed accessible name became "First name *First name is required."). Fixed by moving the error to a sibling of the label, which is also the more correct accessibility pattern.
5. **Clearing the search box left the table showing stale filtered results.** Reported directly by the user testing the running app. Search text (`searchInput`, live) and the actual query driving the API call (`query`, only updated on submit) were two separate pieces of state — typing and clearing the box updated the visible text but not `query`, so the table kept showing the last search's results until Search was clicked again. Fixed by resetting `query` immediately when the input becomes empty.
6. **`softRemove()` silently dropped an unrelated field change on the same entity.** Found live, not by any automated test: after adding logic to force `status` to `INACTIVE` on delete, a direct SQL check (`SELECT status, deletedAt FROM customers WHERE id = ?`) showed `deletedAt` set correctly but `status` unchanged. TypeORM's `softRemove()` only persists the delete-date column, not other dirty fields on the same passed-in entity — a naive `customer.status = INACTIVE; await repo.softRemove(customer)` looks correct and compiles, but the status change never reaches the database. Fixed with an explicit `save()` of the status change before calling `softRemove()`. Flagged in the test plan specifically because a mocked-repository unit test structurally cannot catch this class of bug — the mock has no opinion on which fields a real `softRemove()` does or doesn't persist, so this only surfaced by testing against the real running app and a real database.

## Coverage summary

| Suite | Tests | Result |
|---|---|---|
| Backend unit | 20 | ✅ all passing |
| Backend e2e | 12 | ✅ all passing |
| Frontend | 22 | ✅ all passing |
| Manual/browser acceptance | 10 | ✅ all passing |
| **Total automated** | **54** | ✅ |

Not covered by this test plan, consistent with [[01-requirements|Requirements]]'s out-of-scope list: authentication, multi-entity data (orders/products), bulk import/export, reporting, automatic inactivity detection, and any UI for the activity trail.
