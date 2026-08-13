# Requirements

MyCRM is a proof-of-concept CRM for a digital/e-commerce business, scoped to a single vertical slice: customer operations. This document lists the user stories and the acceptance criteria the shipped code actually satisfies, verified end-to-end (automated tests plus a live browser walkthrough) as of the MVP acceptance pass.

## User stories

### 1. Add a customer

**As** a CRM user, **I want to** add a new customer record **so that** I can start tracking them.

- Opens via the **Add customer** button on the landing page, in a modal form shared with Edit.
- Required: first name, last name, email. Optional: phone, company, status, address fields, lifetime value, notes.
- A blank required field is highlighted in red with an inline message ("First name is required.", etc.) and blocks submission; the message clears as soon as the field is filled.
- Duplicate email (belonging to an active customer) is rejected with `409 Conflict` and the server's message is shown in the form.
- On success the modal closes and the table refreshes to show the new customer.

### 2. View a customer

**As** a CRM user, **I want to** view a customer's full details **so that** I can see their information at a glance.

- There is no separate read-only screen. Clicking a customer's first name in the table opens the same modal used for Edit, pre-filled with every field. Viewing and editing use one form.
- An unknown customer id returns `404 Not Found` from the API.

### 3. Edit a customer

**As** a CRM user, **I want to** update a customer's details **so that** their record stays current.

- Opened the same way as View (click the first name).
- Partial updates: only changed fields are required to resubmit; unedited fields keep their existing values.
- Changing the email to one already in use (by any other customer, active or soft-deleted) is rejected with `409 Conflict`.

### 4. Delete a customer

**As** a CRM user, **I want to** remove one or more customers **so that** the list only shows customers I still need.

- Each row has a checkbox; the header checkbox selects/deselects all rows on the current page.
- The **Delete selected** button is disabled until at least one row is checked, and shows the live selection count.
- Deletion is a **soft delete**: the record is hidden from the table, search, and view/edit, but the row is not physically removed from the database.
- Deleting also sets the customer's `status` to `INACTIVE`, so a raw database query against `status` alone (not just `deletedAt`) correctly reflects that the customer is no longer live — see [[06-decisions|ADR-012]]. The prior status is remembered and restored automatically if the customer is later reactivated.
- An unknown customer id returns `404 Not Found`.

### 5. Search customers

**As** a CRM user, **I want to** search and browse customers **so that** I can find the one I'm looking for.

- A single search box plus a **Search** button filters by first name, last name, email, or company (substring match).
- Every column header is clickable to sort ascending/descending on that column; clicking the same header again flips the direction.
- Results are paginated (10 per page in the UI); the control shows the current page and total.

## Extension: reactivation and activity audit trail

Raised mid-build and folded into the MVP: what should happen if a customer is re-added using the email of a customer that was previously deleted?

- **As** a CRM user, **I want to** re-add a customer by the email of someone I previously deleted **so that** their history isn't lost and they aren't blocked as a duplicate.
  - Re-adding with a soft-deleted customer's email reactivates that same record (same id, original `createdAt`) rather than creating a new row or returning a conflict.
  - Only the fields submitted on the Add form are applied; anything left blank keeps its prior value (address, notes, order history, etc. survive the deletion/reactivation cycle) — including `status`, which delete had forced to `INACTIVE` and reactivation restores to whatever it was before, unless the form explicitly sets a new one.
  - A true duplicate, i.e. an email that belongs to a still-active customer, still returns `409 Conflict`.
- **As** a CRM user, **I want to** see a customer's activity history **so that** I can audit when they were created, deactivated, and reactivated.
  - Every create, soft-delete, and reactivation is logged as a timestamped event (`CREATED` / `DEACTIVATED` / `REACTIVATED`).
  - A customer that cycles through delete and reactivate multiple times has a full chronological trail, not just a single "last changed" timestamp.
  - Retrievable via `GET /api/customers/:id/activity`. No UI for this yet: read via the API only, by design, for this phase.

## Out of scope for this MVP

Explicitly excluded, each raised and deliberately deferred during the build:

- Authentication and user accounts
- Orders, products, or any multi-entity data model (single `Customer` entity only)
- Bulk import/export
- Reporting dashboards
- .NET (evaluated as a backend alternative, not adopted, see [[06-decisions|Decision records]])
- Automatic time-based inactivity detection (auto-setting status to `INACTIVE`)
- Azure deployment (documented as a ready-to-execute phase, not run, see [[07-azure-deployment|Azure deployment]])
- A UI for the activity/audit trail

## Acceptance verification

All of the above was verified together in one MVP acceptance pass, not just per-story in isolation:

- 48 automated tests passing (17 backend unit, 10 backend e2e, 21 frontend component tests) — see [[05-test-plan|Test plan]].
- A live browser walkthrough covering every story above in sequence against the running application, including the validation highlighting and the reactivation/audit cycle, with zero console errors.
- API-level verification of every status code path: `201`/`200`/`204` on success, `400` on invalid input, `404` on unknown ids, `409` on true duplicates.
