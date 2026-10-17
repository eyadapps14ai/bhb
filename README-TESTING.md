# BHB Business Centre dashboard

Offices, tenants, payments and documents for the BHB and 111 branches, in AED.

## Run on your computer
1. Install Node.js 22.13 or newer (Node.js 24 recommended).
2. In the bhb-dashboard folder run:

    npm install
    npm run dev

3. Open http://localhost:5173/

Local development needs no database setup: records are stored in an embedded Postgres under `.data/` and uploads under `.data/uploads/`. You are signed in automatically as a local setup user until the first Super admin account exists; after that, sign in with that account's email and password. To use a real Postgres database instead (for example Neon), set `DATABASE_URL` before `npm run dev`.

## Production (Google Cloud Run)
- **App:** Cloud Run service `bhb-dashboard` in project `apps14-483317`, region `us-east5`, built from the `Dockerfile`.
- **Sign-in:** each person signs in with their own email and password. First setup: leave the email empty and use the shared `APP_PASSWORD`, open **Advanced settings** (in the menu, under your name) and add yourself as Super admin. The shared password stops working as soon as an active Super admin exists.
- **Database:** Neon Postgres. The connection string is stored in Secret Manager as `bhb-database-url`; tables are created automatically on first start.
- **Documents:** Cloud Storage bucket `apps14-483317-bhb-documents`.
- **Roles:** Super admin (everything), Office manager and Sales come built in; more can be added. **Advanced settings** (Users & roles, in the menu under your name) sets, per role, each page to Hidden / View / Edit and turns components on or off (summary cards, Excel export/import, invoices, deleting, seeing every salesperson's commission). Branches (BHB, 111) are set per person. The server enforces the same rules on every request.
- **New lease:** Lease contracts > New lease > choose a vacant office (or New office) > tenant, dates, rent, Sold by > Save lease.
- **Lease contracts:** Overview or Analytical (grouped grid); every lease (current, ended, cancelled) with its contract value, invoices, payments, the cash received against it and what is still to collect. Create an invoice or add a payment from the contract.
- **Employees and sales commission:** each employee has a Job; Sales employees carry their commission % for new leases and renewals. Choose the Sales employee in **Sold by** (and New / Renewal) on an office lease. Commission = that employee's rate × the whole contract value (rent over the lease, excluding VAT and deposit), counted in the month the lease starts. Click an employee to see their details, linked login and leases sold. Give an employee their dashboard login in the same form (Add or Edit employee > Dashboard login: role, branches, password; they sign in with the employee email), so a salesperson sees their own commission. Logins for people who are not employees are added in Advanced settings. The Sales commission page can count commission on the contract value (month the lease starts) or, as an option, on cash received (month each rent payment clears).

Environment variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (from Secret Manager in production) |
| `GCS_BUCKET` | Cloud Storage bucket for uploaded documents |
| `APP_PASSWORD` | Shared password for first setup only (signs in a temporary setup account while no Super admin exists) |
| `SESSION_SECRET` | Optional key that signs sign-in cookies; falls back to `APP_PASSWORD`. Changing it signs everyone out |
| `VINEXT_TRUST_PROXY` | Set to `1` in the Dockerfile so request URLs use Cloud Run's HTTPS address |

Deploy a new version:

    gcloud run deploy bhb-dashboard --source . --region=us-east5 --project=apps14-483317

Give another person access: open **Users & roles**, Add user, choose their role and branches and set a first password (at least 10 characters).

## Features to test
- Sign in as each role (Super admin, Office manager, Sales) and check the menu, branches and buttons each one gets.
- Sales commission by month for a salesperson, new and renewal rates.
- Branch selection and separate summaries (BHB / 111).
- Physical and virtual office lists; tenant, licence and lease details.
- Income: rent, PRO services, VAT and deposits; expenses and checks.
- PDF/JPG/PNG uploads linked to offices and payments.
- Accounts: date-range reports, office reports, Excel import/export.
- WhatsApp: prepares chats for manual sending only; automatic API sending is not connected.
- Theme (side bar): Modern or Classic, kept per browser. In Modern every data page has an Overview (one big figure, three stats, a "needs you" strip and three cards) and an Analysis (Group by, share-of-largest bars, Export CSV). Classic keeps Overview / Analytical with the grouped table.
- Employees: Employees | Requests tabs at the top; employees show as cards (Overview) or the grouped table (Analytical / Analysis).
- Lease contracts: leases without a salesperson show "Set seller" (opens the lease form). In a new lease, Sold by is the first field; if nobody has the Sales job, the form says how to add one.

## Useful checks
    npx tsc --noEmit
    npm run build

VAT collected is a tracking total, not a VAT return calculation; deposits received are not refund-adjusted balances.
