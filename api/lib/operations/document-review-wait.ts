import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

/** Queue evidence only. This does not fabricate delivery of an email or pause the service clock. */
export async function documentReviewWait(connection: PoolConnection, applicationId: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(`SELECT r.id,r.outcome,UNIX_TIMESTAMP(r.created_at)*1000 occurred,
    (SELECT MAX(UNIX_TIMESTAMP(e.created_at)*1000) FROM document_lifecycle_events e
      WHERE e.document_event_application_id=r.application_id AND e.created_at>r.created_at
      AND e.document_lifecycle_event_type IN ('UPLOADED','REPLACED')) response
    FROM operations_action_events r WHERE r.application_id=? AND r.action_type='HUMAN_REVIEW'
    ORDER BY r.entity_version_after DESC LIMIT 1`, [applicationId]);
  const row = rows[0];
  return row ? { id: String(row.id), occurred: Number(row.occurred), response: row.response == null ? null : Number(row.response),
    waiting: row.outcome === 'NEEDS_CORRECTION' && row.response == null } : null;
}
