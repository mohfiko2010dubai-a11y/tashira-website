# Editing document requirements

The editable source is `contracts/document-requirement-rules.json`. Customer
uploads, server evaluation, payment readiness and the Admin Visa Rules preview
use the same engine and saved nationality/residence/visa/purpose values.

Each row contains its document key, existing storage code/type, English and
Arabic labels and hints, `applies_when`, `status` and `placeholder`.
Use ISO country codes (SA, KW, BH, QA, OM, AE, PK, IQ, IR, AF).
An empty `applies_when` means every applicant; fields within a row are ANDed.
Matching rows form a union, deduplicated by `key`.

Only `approved` rows are customer requirements. Country and nationality rows
are intentionally `draft`: approval of Task 2 implementation is not approval
of their publication. The Admin Visa Rules page shows matching drafts and
wording placeholders separately. Its default Pakistan/Saudi/30-day/tourism
preview shows 3 approved, 5 draft requirements and 1 wording placeholder.

To publish a reviewed rule, edit the relevant row's status to `approved`.
For the passport-pages placeholder, first replace the TBD label and hint with
approved EN/AR wording and set `placeholder` to false. The validator rejects
approval while `placeholder` remains true. Keep keys/codes stable so existing
uploads remain linked. Add a new key when a different document is required.
Bump `OWNER_DOCUMENT_VERSION` in `owner-document-requirements.ts` for a published
policy change, then run check, lint, tests and build and review the Admin preview
before deploying through the existing staging process.

The 2026-09-13 base set supersedes the earlier no-ticket instruction: approved
visit rules now request a confirmed return/onward ticket; non-GCC residence
adds accommodation; visiting-family purpose adds host details; transit purpose
adds an onward ticket. No immigration approval guarantee is introduced.

Trip purpose is saved per traveller in the existing versioned profile JSON.
It survives reload and is used by payment readiness; no database migration is
needed. After changing details, Save details & show documents recomputes the
server-backed list, retains receipts for applicable keys and labels newly
required documents.
