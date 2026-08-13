# Azure Deployment (deferred)

This is a ready-to-execute plan, documented per [[06-decisions|ADR-007]] but **not run**. Local development (Homebrew MySQL, two `npm run dev` processes) has been the only environment used so far. Nothing here has been verified against a real Azure subscription.

## Cost caveat — read this before starting

**Azure Database for MySQL Flexible Server's free allowance is a 12-month new-account offer, not permanently free.** After that window (or on an account that's already used it), the database incurs real cost. App Service's F1 tier and Static Web Apps' free tier are free indefinitely, but check the MySQL cost specifically before running any of the steps below on a non-trial account.

## Target architecture

| Local (current) | Azure equivalent | Tier |
|---|---|---|
| NestJS on `localhost:3001` | Azure App Service (Linux, Node.js) | F1 (free) |
| Next.js on `localhost:3000` | Azure Static Web Apps | Free |
| Homebrew MySQL on `localhost:3306` | Azure Database for MySQL Flexible Server | Burstable B1ms (12-month free trial allowance) |

## Prerequisites

- An Azure account and subscription.
- Azure CLI (`az`) installed and logged in (`az login`).
- The two migrations in [`apps/api/src/migrations/`](../apps/api/src/migrations/) run cleanly locally (they already have, see [[05-test-plan|Test plan]]).

## Steps

### 1. Resource group

```bash
az group create --name mycrm-rg --location canadacentral
```

### 2. MySQL Flexible Server

```bash
az mysql flexible-server create \
  --resource-group mycrm-rg \
  --name mycrm-mysql \
  --location canadacentral \
  --admin-user mycrmadmin \
  --admin-password '<choose a strong password>' \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 8.0.21

az mysql flexible-server db create \
  --resource-group mycrm-rg \
  --server-name mycrm-mysql \
  --database-name crm_poc

az mysql flexible-server firewall-rule create \
  --resource-group mycrm-rg \
  --name mycrm-mysql \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

Run the migrations against this server before deploying the API (from a machine with network access to it, using the same TypeORM CLI already set up locally):

```bash
cd apps/api
DB_HOST=mycrm-mysql.mysql.database.azure.com \
DB_PORT=3306 \
DB_USERNAME=mycrmadmin \
DB_PASSWORD='<the password above>' \
DB_DATABASE=crm_poc \
npm run migration:run
```

### 3. App Service for the API

```bash
az appservice plan create \
  --resource-group mycrm-rg \
  --name mycrm-api-plan \
  --sku F1 \
  --is-linux

az webapp create \
  --resource-group mycrm-rg \
  --plan mycrm-api-plan \
  --name mycrm-api \
  --runtime "NODE:20-lts"

az webapp config appsettings set \
  --resource-group mycrm-rg \
  --name mycrm-api \
  --settings \
    PORT=8080 \
    DB_HOST=mycrm-mysql.mysql.database.azure.com \
    DB_PORT=3306 \
    DB_USERNAME=mycrmadmin \
    DB_PASSWORD='<the password above>' \
    DB_DATABASE=crm_poc
```

Deploy via `git push` to the App Service's deployment remote, or `az webapp deploy` with a zipped `apps/api/dist` build — either works with `apps/api`'s existing `npm run build` / `npm run start:prod` scripts.

**Code change needed before deploying:** [`main.ts`](../apps/api/src/main.ts)'s CORS origin is hardcoded to `http://localhost:3000`. It needs to allow the deployed Static Web App's URL instead (or both, for continued local development against the deployed API).

### 4. Static Web App for the frontend

```bash
az staticwebapp create \
  --resource-group mycrm-rg \
  --name mycrm-web \
  --location eastus2 \
  --sku Free
```

Set `NEXT_PUBLIC_API_URL` (currently in [`apps/web/.env.local`](../apps/web/.env.local), gitignored) to the deployed API's URL, e.g. `https://mycrm-api.azurewebsites.net/api`, as a Static Web Apps application setting or a build-time environment variable, depending on the deployment method chosen (GitHub Actions integration is the usual path for Static Web Apps and wasn't set up as part of this PoC — this repository has no `.github/workflows/` yet).

### 5. Verify

Same acceptance pass as [[05-test-plan|Test plan]]'s manual/browser walkthrough, against the deployed URLs instead of `localhost`: add, search, sort, edit, bulk delete, and the reactivation/activity cycle.

## Not covered here

- CI/CD (GitHub Actions or Azure DevOps pipeline) — none exists yet, deployment above is manual.
- A production `.env` secrets story beyond App Service's application settings (e.g. Azure Key Vault).
- Scaling past the free tiers — F1 App Service has real CPU/memory limits unsuitable for anything beyond a demo.
- Custom domain / TLS beyond what Static Web Apps and App Service provide by default.
