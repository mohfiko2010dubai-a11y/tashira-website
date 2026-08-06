# TASHIRA Blocked Decisions

## Wizard and legacy chat applicant persistence

The active schema stores applicant details in the normalized `applicants` table and derives the applicant count from those rows. The wizard and legacy chat API implementations still attempt to update historical flat applicant fields on `applications` through broadly typed update objects.

Before changing this runtime behavior, confirm:

1. The production MySQL schema contains the normalized `applicants` table exactly as represented by `db/schema.ts`.
2. Partial wizard applications should create an applicant row as soon as a name is collected.
3. Subsequent wizard steps should update applicant index `0`, and family applications should create additional rows only when their individual details are collected.
4. Existing incomplete applications do not depend on historical flat columns that are absent from the repository schema.

No schema migration or production database operation is authorized as part of stabilization.
