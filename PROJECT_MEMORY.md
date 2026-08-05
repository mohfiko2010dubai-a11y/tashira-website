# Project memory

## Project

- TASHIRA UAE visa application platform.
- Repository: `tashira-website`.
- Main branch: `main`.

## Production

- Database: MySQL hosted on the production server.
- Documents: server filesystem at `/var/www/tashira/storage/documents`.
- Supabase: legacy/inactive unless runtime verification proves otherwise.
- Process manager: PM2.
- Reverse proxy: Nginx.

## Critical rules

- Never expose secrets.
- Never delete customer documents.
- Never alter the production database without verified backup and explicit approval.
- Never trust browser amounts for Stripe.
- Never deploy without explicit approval.
- Never assume repository configuration matches production.
- Never use production customer data in tests.
- Never migrate data or storage to Supabase without explicit approval.

## Priority areas

- Backend authorization.
- Admin and staff authentication.
- Stripe verification and webhooks.
- Database/schema drift.
- Document access security.
- Conflicting deployment systems.
- Automated tests and CI gates.

## Before database or storage work

Verify `DATABASE_URL` identity without exposing it, active storage implementation, `STORAGE_ROOT`, Docker volumes, resolved filesystem paths, permissions, disk space, backup timestamps, and restore readiness.
