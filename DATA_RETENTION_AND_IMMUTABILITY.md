# TASHIRA Data Retention and Immutability

## Categories

- Identity documents
- Application records
- Payment records
- Chargeback evidence
- Audit logs

Retention policy versions may define a duration after business/legal approval. A null duration deliberately means that no engineering assumption has been made.

## Workflow

Each retention record has a retention start and optional scheduled deletion date. Legal holds are placed and released through authorized admin operations. Every hold transition is an immutable event with reason, actor, and server timestamp. Deletion evaluation creates an audit event and never performs deletion. An active legal hold always returns `BLOCKED_LEGAL_HOLD`.

Releasing a hold returns the record to its existing retention schedule. Actual deletion requires a separate approved implementation with verified backups, storage/database coordination, and authorization.

## MySQL enforcement

Migration `005_business_architecture.sql` proposes `BEFORE UPDATE` and `BEFORE DELETE` rejection triggers for application timelines, price snapshots, financial events, risk assessments, legal-hold events, deletion audits, outbound-email events, and document lifecycle events. Corrections are new events or versions.

The migration was created only. It was not applied to staging or production. Trigger compatibility and least-privilege runtime grants must be verified in staging before approval.

## Privacy

Recovery destinations and secrets are hashed. Document lifecycle rows reference existing documents and never duplicate their content. Financial events store provider references rather than raw payloads. Retention operations must not expose customer documents or environment values.
