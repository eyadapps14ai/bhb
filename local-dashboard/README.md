# Latest BHB local dashboard

This folder is the latest local dashboard source from the working app. The repository root retains the existing Google Cloud Run version. This folder uses Cloudflare D1/R2 and must be adapted before replacing that deployment.

Includes lease cancellation/history, employee directory and request reviews, Gmail connection setup, client TRN and billing address, and customer rent/service tax invoices.

No customer records, uploads, local database or credentials are included. Personal notification email and WhatsApp number are replaced with placeholders; configure them privately before use. Google OAuth credentials are not configured.

## Local setup

Use Node.js 22.13 or newer. Run `npm ci`, then `npm run build`. Apply each SQL migration under `drizzle/` in filename order to a fresh local database using:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/FILENAME.sql
```

Replace FILENAME.sql with each migration filename. Do not replay migrations on an existing database. Run `npm run dev` and open http://127.0.0.1:5173/. Local preview uses a test identity; individual owner/employee email/password accounts are not implemented.

## Customer invoices

Accounts → Supplier details means your business as the invoice issuer. Save its legal name, address and TRN once. From Add income, choose an office and use Save & create invoice; review and issue. Existing income has an Invoice action. Office details also offer Create invoice for rent. Print / Save PDF downloads the issued invoice. Sending invoice emails remains manual.
