# Test Plan

## Strategy

Four layers, each catching a different class of bug; all four found real issues during the build (noted per layer below, not hypothetically):

1. **Backend unit tests** — `CustomersService` in isolation, both TypeORM repositories mocked. Fast, precise on business-rule branches (conflict vs. reactivate vs. fresh create, not-found paths).
2. **Backend e2e tests** — a real NestJS app over real HTTP against a dedicated database (`crm_poc_test`), exercising the full controller → service → TypeORM → MySQL path, including status codes.
3. **Frontend component tests** — React Testing Library against `CustomerFormModal`, `CustomerTable`, and the landing page, with `lib/api.ts` mocked. Catches UI-layer bugs (validation display, accessible labelling) that pass at the API level but break in the browser.
4. **Manual/browser acceptance** — a Playwright-driven walkthrough of the whole running application (both dev servers, real MySQL), because passing automated suites in isolation doesn't prove the pieces work *together*. This is the layer that caught the two most interesting bugs (below).

## Backend unit tests

**File:** [`apps/api/src/customers/customers.service.spec.ts`](../apps/api/src/customers/customers.service.spec.ts) — 17 tests, all passing. 100% statement coverage / 92% branch coverage on `CustomersService`.

| Area | Cases |
|---|---|
| `create` | fresh insert logs `CREATED`; active-duplicate email → `ConflictException`; soft-deleted email → reactivation merging only submitted fields |
| `findAll` | search/status/sort/pagination query building; defaults when the query is empty |
| `findOne` | returns customer; `NotFoundException` for unknown id |
| `update` | merges dto onto existing; skips the email-availability check when email is unchanged; `ConflictException` when changing to an in-use email |
| `remove` / `removeMany` | soft-removes and logs `DEACTIVATED`; `NotFoundException` / no-op for unknown ids |
| `getActivity` | chronological order; works for soft-deleted customers; `NotFoundException` for an id that never existed |

Run: `npm test` in `apps/api` (or `npm run test:api` from the repo root).

## Backend e2e tests

**File:** [`apps/api/test/customers.e2e-spec.ts`](../apps/api/test/customers.e2e-spec.ts) — 10 tests, all passing, against `crm_poc_test` (truncated before each test).

| Area | Cases |
|---|---|
| Full lifecycle | create → view → search → edit → delete → confirm 404 and search-invisibility |
| Validation and conflicts | `400` on an invalid payload; `409` on a duplicate active email; `404` on an unknown id for view/edit/delete |
| Bulk delete | soft-deletes selected ids, leaves the rest; `400` on an empty `ids` array |
| Reactivation and audit trail | `CREATED` → `DEACTIVATED` → `REACTIVATED` sequence with preserved fields; a still-active duplicate email still `409`s; `404` for activity on an id that never existed |

Run: `npm run test:e2e` in `apps/api` (or `npm run test:api:e2e` from the repo root).

## Frontend tests

**Files:** [`CustomerFormModal.test.tsx`](../apps/web/components/CustomerFormModal.test.tsx), [`CustomerTable.test.tsx`](../apps/web/components/CustomerTable.test.tsx), [`page.test.tsx`](../apps/web/app/page.test.tsx) — 21 tests, all passing.

| Area | Cases |
|---|---|
| Form (add/edit rendering) | empty form in add mode; pre-filled form in edit mode |
| Form (validation) | blank required fields show a message under each field, in red, with `aria-invalid`; only actually-blank fields are flagged; typing clears that field's error |
| Form (submission) | successful add calls `createCustomer`; successful edit calls `updateCustomer` (not create); a `409` from the API shows the server message and does not close the modal; Cancel calls `onClose` |
| Table | renders rows; loading and empty states; clicking a header calls `onSortChange` with the right column and shows the sort arrow; select-all and per-row checkboxes call their handlers; clicking a first name calls `onEditCustomer` |
| Landing page | loads customers with default params on mount; searching resets to page 1 and passes the query through; Add button opens the modal |

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

## Bugs this test plan actually caught

Recorded because they're evidence the layers are doing their job, not just green checkmarks:

1. **Soft-deleted email caused a raw `500`, not a clean `409`.** Found manually in the browser during Phase 3, before the reactivation feature existed. `assertEmailIsAvailable` only checked non-deleted rows, but MySQL's unique index on `email` still counts soft-deleted rows. Fixed with `withDeleted: true`.
2. **Reactivation silently corrupted the API response** (not the database). Found while building the reactivation feature: `CreateCustomerDto`'s optional fields compile to real own properties initialized to `undefined` (this project's ES2023 TS target implies `useDefineForClassFields`), so a naive `Object.assign(existing, dto)` overwrote every blank field with `undefined`. TypeORM correctly skipped those columns in the SQL `UPDATE`, but coerced them to `null` on the object handed back to the caller — so the database was right and the response lied about it. Fixed by merging only `dto`'s defined-value entries.
3. **The custom validation message was dead code for the fully-blank case.** Found while writing the frontend unit test for it: the required inputs also had a native HTML `required` attribute, which blocks form submission (and the `onSubmit` handler) before the app's own JS validation ever ran. Fixed by removing `required` so the app's own validation is the only validation path — which is also what made the later per-field red-highlight redesign possible to build and test cleanly.
4. **The per-field error message broke the input's accessible label** when first implemented. Found immediately by the new RTL test: the error text was rendered inside the `<label>` element, so once an error appeared, `getByLabelText('First name *')` no longer matched (the label's computed accessible name became "First name *First name is required."). Fixed by moving the error to a sibling of the label, which is also the more correct accessibility pattern.

## Coverage summary

| Suite | Tests | Result |
|---|---|---|
| Backend unit | 17 | ✅ all passing |
| Backend e2e | 10 | ✅ all passing |
| Frontend | 21 | ✅ all passing |
| Manual/browser acceptance | 10 | ✅ all passing |
| **Total automated** | **48** | ✅ |

Not covered by this test plan, consistent with [[01-requirements|Requirements]]'s out-of-scope list: authentication, multi-entity data (orders/products), bulk import/export, reporting, automatic inactivity detection, and any UI for the activity trail.
