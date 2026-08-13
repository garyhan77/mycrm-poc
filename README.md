# MyCRM

A proof-of-concept CRM for a digital/e-commerce business: customer operations (Add, View, Edit, Delete, Search), plus a reactivation-and-audit-trail extension. Built as a portfolio/coursework SDLC exercise: explicit MVC architecture, versioned migrations, full test coverage, and reverse-documented SDLC artifacts.

See `docs/` for the full documentation set: [requirements](docs/01-requirements.md), [architecture](docs/02-architecture.md), [ERD](docs/03-erd.md), [sequence diagrams](docs/04-sequence-diagrams.md), [test plan](docs/05-test-plan.md), [decision records](docs/06-decisions.md), and the (deferred) [Azure deployment plan](docs/07-azure-deployment.md).

## Stack

- **Backend:** NestJS + TypeORM, `apps/api`, port 3001
- **Frontend:** Next.js (App Router) + Tailwind, `apps/web`, port 3000
- **Database:** MySQL 8/9, local via Homebrew

## Prerequisites

- Node.js 20+ and npm
- Homebrew MySQL (`brew install mysql`), or any MySQL 8+ server you point the API at

## Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/garyhan77/mycrm-poc.git
   cd mycrm-poc
   ```

2. **Install dependencies** (npm workspaces, run once from the repo root):

   ```bash
   npm install
   ```

3. **Start MySQL** and create the databases:

   ```bash
   brew services start mysql

   mysql -u root <<'SQL'
   CREATE DATABASE IF NOT EXISTS crm_poc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE DATABASE IF NOT EXISTS crm_poc_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER IF NOT EXISTS 'crm_app'@'localhost' IDENTIFIED BY 'crm_app_dev_pw';
   GRANT ALL PRIVILEGES ON crm_poc.* TO 'crm_app'@'localhost';
   GRANT ALL PRIVILEGES ON crm_poc_test.* TO 'crm_app'@'localhost';
   FLUSH PRIVILEGES;
   SQL
   ```

4. **Configure environment variables:**

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

   The defaults in both files match the database/user created above and point the frontend at `http://localhost:3001/api`; adjust if you used different credentials.

5. **Run migrations** (creates `customers` and `customer_activities` in both databases):

   ```bash
   cd apps/api
   npm run migration:run
   DB_DATABASE=crm_poc_test npm run migration:run
   cd ../..
   ```

6. **Seed demo data** (30 customers with `CREATED` activity records):

   ```bash
   cd apps/api && npm run seed && cd ../..
   ```

## Running

From the repo root:

```bash
npm run dev:api   # NestJS on http://localhost:3001
npm run dev:web   # Next.js on http://localhost:3000
```

Run both in separate terminals, then open `http://localhost:3000`.

## Testing

```bash
npm run test:api        # backend unit tests (CustomersService, mocked repositories)
npm run test:api:e2e    # backend e2e tests (real HTTP, against crm_poc_test)
npm run test:web        # frontend component tests (React Testing Library)
```

All three suites are described in detail, including what each test covers and the bugs they caught, in [`docs/05-test-plan.md`](docs/05-test-plan.md).

## Project structure

```
CRM PoC/
├── apps/
│   ├── api/                  # NestJS backend
│   │   └── src/customers/    # entity, DTOs, service, controller, module
│   └── web/                  # Next.js frontend
│       ├── app/               # the single landing page
│       ├── components/        # CustomerTable, CustomerFormModal
│       └── lib/                # typed API client, shared types
├── docs/                     # SDLC deliverables (this documentation set)
└── notes/                    # Obsidian working notes (not deliverables)
```

## Known limitations

See [`docs/01-requirements.md`](docs/01-requirements.md#out-of-scope-for-this-mvp) for the full out-of-scope list (auth, orders/products, bulk import/export, reporting, .NET, automatic inactivity detection) and [`docs/07-azure-deployment.md`](docs/07-azure-deployment.md) for the deferred cloud deployment plan.
