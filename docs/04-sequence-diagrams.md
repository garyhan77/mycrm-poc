# Sequence Diagrams

One diagram per story, reverse-documented from the actual code paths in [`customers.controller.ts`](../apps/api/src/customers/customers.controller.ts) and [`customers.service.ts`](../apps/api/src/customers/customers.service.ts), including the alternate (error) flows the code actually implements. Where the real UI takes a shortcut against the "canonical" API shape, that's called out rather than smoothed over.

## Add a customer (including reactivation)

This is the one code path (`CustomersService.create`) with three branches: a genuinely new email, an email that belongs to a still-active customer (blocked), and an email that belongs to a soft-deleted customer (reactivated). See [[01-requirements|Requirements]] for the reactivation story.

```mermaid
sequenceDiagram
    actor U as User
    participant V as Next.js View<br/>(CustomerFormModal)
    participant C as CustomersController
    participant S as CustomersService
    participant R as TypeORM Repository
    participant DB as MySQL

    U->>V: Fill form, click "Add customer"
    alt required field blank
        V-->>U: Red highlight + inline message<br/>(no request sent)
    else all required fields present
        V->>C: POST /api/customers
        C->>C: ValidationPipe (DTO)
        alt DTO invalid
            C-->>V: 400 Bad Request
            V-->>U: Show error banner
        else DTO valid
            C->>S: create(dto)
            S->>R: findOne({ email }, withDeleted: true)
            R->>DB: SELECT * FROM customers WHERE email = ?
            DB-->>R: row or none
            R-->>S: existing | null
            alt existing and active (deletedAt IS NULL)
                S-->>C: throw ConflictException
                C-->>V: 409 Conflict
                V-->>U: Show error banner
            else existing and soft-deleted
                Note over S: Reactivation: merge only submitted<br/>fields, keep the rest untouched
                S->>R: save(existing, deletedAt = null)
                R->>DB: UPDATE customers SET ...
                S->>R: activityRepo.save({customerId, type: REACTIVATED})
                R->>DB: INSERT INTO customer_activities ...
                S-->>C: Customer (reactivated, same id)
                C-->>V: 201 Created
                V-->>U: Close modal, refresh table
            else no existing row
                S->>R: create(dto) + save()
                R->>DB: INSERT INTO customers ...
                S->>R: activityRepo.save({customerId, type: CREATED})
                R->>DB: INSERT INTO customer_activities ...
                S-->>C: Customer (new)
                C-->>V: 201 Created
                V-->>U: Close modal, refresh table
            end
        end
    end
```

## Search / list customers

Backs the landing page table, and also what "View" actually relies on in the shipped UI (see the note in the next diagram).

```mermaid
sequenceDiagram
    actor U as User
    participant V as Next.js View<br/>(page.tsx)
    participant C as CustomersController
    participant S as CustomersService
    participant R as TypeORM QueryBuilder
    participant DB as MySQL

    U->>V: Type a search term, click "Search"<br/>(or click a column header to sort,<br/>or Previous/Next to page)
    V->>C: GET /api/customers?q=&status=&page=&limit=&sortBy=&sortOrder=
    C->>S: findAll(query)
    S->>R: createQueryBuilder('customer')
    opt q present
        S->>R: andWhere(firstName/lastName/email/company LIKE :q)
    end
    opt status present
        S->>R: andWhere(status = :status)
    end
    S->>R: orderBy(sortBy, sortOrder).skip().take()
    R->>DB: SELECT ... WHERE ... ORDER BY ... LIMIT ... OFFSET ...
    DB-->>R: rows, count
    R-->>S: [data, total]
    S-->>C: { data, total, page, limit }
    C-->>V: 200 OK
    V-->>U: Render table + pagination control
```

## View a single customer

The API exposes a canonical single-customer fetch, exercised directly by the e2e tests. The shipped UI takes a shortcut against it: clicking a first name opens the edit modal from the row object already held in the table's in-memory state (populated by the Search/List call above), not a fresh request — there's no perceptible loading state for View because of it. The endpoint still exists and matters for any future direct-link consumer.

```mermaid
sequenceDiagram
    actor U as User
    participant V as Next.js View
    participant C as CustomersController
    participant S as CustomersService
    participant R as TypeORM Repository
    participant DB as MySQL

    Note over V: Actual UI: opens CustomerFormModal<br/>from the row already in table state.<br/>No request is made.

    Note over C,DB: Canonical API path (used by e2e tests,<br/>available for direct-link support):
    V->>C: GET /api/customers/:id
    C->>S: findOne(id)
    S->>R: findOne({ where: { id } })
    R->>DB: SELECT * FROM customers WHERE id = ?<br/>(deletedAt IS NULL, implicit)
    DB-->>R: row or none
    alt found
        R-->>S: Customer
        S-->>C: Customer
        C-->>V: 200 OK
    else not found (or soft-deleted)
        R-->>S: null
        S-->>C: throw NotFoundException
        C-->>V: 404 Not Found
    end
```

## Edit a customer

```mermaid
sequenceDiagram
    actor U as User
    participant V as Next.js View<br/>(CustomerFormModal, pre-filled)
    participant C as CustomersController
    participant S as CustomersService
    participant R as TypeORM Repository
    participant DB as MySQL

    U->>V: Change a field, click "Save changes"
    V->>C: PATCH /api/customers/:id
    C->>C: ValidationPipe (partial DTO)
    C->>S: update(id, dto)
    S->>R: findOne({ where: { id } })
    R->>DB: SELECT * FROM customers WHERE id = ?
    alt not found
        R-->>S: null
        S-->>C: throw NotFoundException
        C-->>V: 404 Not Found
    else found
        R-->>S: customer
        opt dto.email changed
            S->>R: findOne({ email }, withDeleted: true)
            R->>DB: SELECT * FROM customers WHERE email = ?
            alt email already in use
                R-->>S: existing row
                S-->>C: throw ConflictException
                C-->>V: 409 Conflict
            end
        end
        S->>S: Object.assign(customer, dto)
        S->>R: save(customer)
        R->>DB: UPDATE customers SET ...
        R-->>S: updated Customer
        S-->>C: Customer
        C-->>V: 200 OK
        V-->>U: Close modal, refresh table
    end
```

## Delete a customer (single and bulk)

Both routes share the same soft-delete-plus-activity-log pattern; bulk delete repeats it once per selected id.

```mermaid
sequenceDiagram
    actor U as User
    participant V as Next.js View<br/>(CustomerTable + page.tsx)
    participant C as CustomersController
    participant S as CustomersService
    participant R as TypeORM Repository
    participant DB as MySQL

    Note over V: The UI has no single-row delete button,<br/>selection always goes through checkboxes,<br/>even for one row.

    U->>V: Check row(s), click "Delete selected", confirm
    V->>C: DELETE /api/customers { ids: [...] }
    C->>S: removeMany(ids)
    S->>R: findBy({ id: In(ids) })
    R->>DB: SELECT * FROM customers WHERE id IN (...)
    R-->>S: matching customers
    S->>R: softRemove(customers)
    R->>DB: UPDATE customers SET deletedAt = NOW() WHERE id IN (...)
    loop each customer
        S->>R: activityRepo.save({customerId, type: DEACTIVATED})
        R->>DB: INSERT INTO customer_activities ...
    end
    S-->>C: void
    C-->>V: 204 No Content
    V-->>U: Refresh table (deleted rows gone)

    Note over C,DB: DELETE /api/customers/:id (single) follows<br/>the identical pattern for one customer,<br/>returning 404 if the id doesn't exist.
```

## Get activity trail (extension)

```mermaid
sequenceDiagram
    participant Caller as API caller<br/>(no UI yet)
    participant C as CustomersController
    participant S as CustomersService
    participant R as TypeORM Repository
    participant DB as MySQL

    Caller->>C: GET /api/customers/:id/activity
    C->>S: getActivity(id)
    S->>R: findOne({ where: { id } }, withDeleted: true)
    R->>DB: SELECT * FROM customers WHERE id = ?
    alt customer never existed
        R-->>S: null
        S-->>C: throw NotFoundException
        C-->>Caller: 404 Not Found
    else customer exists (active or soft-deleted)
        R-->>S: customer
        S->>R: activityRepo.find({ customerId }, order by occurredAt ASC)
        R->>DB: SELECT * FROM customer_activities WHERE customerId = ? ORDER BY occurredAt ASC
        DB-->>R: rows
        R-->>S: activities
        S-->>C: CustomerActivity[]
        C-->>Caller: 200 OK
    end
```
