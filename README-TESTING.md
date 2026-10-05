# BHB Business Centre dashboard

Offices, tenants, payments and documents for the BHB and 111 branches, in AED.

## Run on your computer
1. Install Node.js 22.13 or newer (Node.js 24 recommended).
2. In the bhb-dashboard folder run:

    npm install
    npm run dev

3. Open http://localhost:5173/

Local development needs no database setup: records are stored in an embedded Postgres under `.data/` and uploads under `.data/uploads/`. You are signed in automatically as a local test user. To use a real Postgres database instead (for example Neon), set `DATABASE_URL` before `npm run dev`.

## Production (Google Cloud Run)
- **App:** Cloud Run service `bhb-dashboard` in project `apps14-483317`, region `us-east5`, built from the `Dockerfile`.
- **Sign-in:** Google Identity-Aware Proxy (IAP). Only Google accounts granted access can open the app; the app verifies IAP's signed header on every request.
- **Database:** Neon Postgres. The connection string is stored in Secret Manager as `bhb-database-url`; tables are created automatically on first start.
- **Documents:** Cloud Storage bucket `apps14-483317-bhb-documents`.
- **Records are shared:** everyone who can sign in sees and edits the same offices, payments and documents.

Environment variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (from Secret Manager in production) |
| `GCS_BUCKET` | Cloud Storage bucket for uploaded documents |
| `IAP_AUDIENCE` | `/projects/PROJECT_NUMBER/locations/REGION/services/SERVICE`; required in production, requests are refused without it |
| `VINEXT_TRUST_PROXY` | Set to `1` in the Dockerfile so request URLs use Cloud Run's HTTPS address |

Deploy a new version:

    gcloud run deploy bhb-dashboard --source . --region=us-east5 --project=apps14-483317

Give another person access:

    gcloud iap web add-iam-policy-binding --member=user:EMAIL --role=roles/iap.httpsResourceAccessor --region=us-east5 --resource-type=cloud-run --service=bhb-dashboard --project=apps14-483317

## Features to test
- Branch selection and separate summaries (BHB / 111).
- Physical and virtual office lists; tenant, licence and lease details.
- Income: rent, PRO services, VAT and deposits; expenses and checks.
- PDF/JPG/PNG uploads linked to offices and payments.
- Accounts: date-range reports, office reports, Excel import/export.
- WhatsApp: prepares chats for manual sending only; automatic API sending is not connected.

## Useful checks
    npx tsc --noEmit
    npm run build

VAT collected is a tracking total, not a VAT return calculation; deposits received are not refund-adjusted balances.
