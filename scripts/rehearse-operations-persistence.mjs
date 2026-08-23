import mysql from "mysql2/promise";
import assert from "node:assert/strict";

const rawUrl = process.env.OPS_REHEARSAL_DATABASE_URL;
assert(rawUrl, "OPS_REHEARSAL_DATABASE_URL is required");
const target = new URL(rawUrl);
assert(["127.0.0.1", "localhost"].includes(target.hostname), "Rehearsal database must be local");
assert.equal(target.port, "33306", "Unexpected rehearsal port");
assert(target.pathname.slice(1).startsWith("tashira_ops_rehearsal_"), "Unexpected rehearsal database");

const pool = mysql.createPool({ uri: rawUrl, connectionLimit: 4, multipleStatements: false });
const report = {};
const ids = {
  sourceSnapshot: "synthetic-source-snapshot-1",
  ruleV1: "synthetic-rule-version-1",
  ruleV2: "synthetic-rule-version-2",
  reviewV1: "synthetic-rule-review-1",
  reviewV2: "synthetic-rule-review-2",
  evaluationV1: "synthetic-evaluation-v1",
  evaluationV2: "synthetic-evaluation-v2",
};

async function rejectsSql(work, expected) {
  try { await work(); } catch (error) {
    assert.match(String(error.message), expected);
    return;
  }
  assert.fail(`Expected SQL rejection: ${expected}`);
}

async function transaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

try {
  const [[identity]] = await pool.query("SELECT VERSION() version, DATABASE() databaseName, @@hostname hostname");
  assert.match(identity.version, /^8\./);
  assert.equal(identity.databaseName, target.pathname.slice(1));
  report.identity = "PASS";

  const [[counts]] = await pool.query("SELECT (SELECT COUNT(*) FROM applications) applications, (SELECT COUNT(*) FROM applicants) applicants, (SELECT COUNT(*) FROM documents) documents, (SELECT COUNT(*) FROM payments) payments, (SELECT COUNT(*) FROM invoices) invoices");
  assert.deepEqual(Object.values(counts).map(Number), [2, 5, 5, 1, 1]);
  report.legacyIntegrity = "PASS";

  await pool.query("INSERT INTO operations_departments (id,code,name) VALUES (1,'SYN-OPS','Synthetic Operations')");
  await pool.query("INSERT INTO operations_teams (id,department_id,code,name) VALUES (1,1,'SYN-TEAM','Synthetic Team')");
  await pool.query("INSERT INTO visa_rule_sources (id,authority,title,source_url,classification) VALUES (1,'Synthetic Authority','Synthetic Source','https://example.invalid/official-rule','OFFICIAL')");
  await pool.query("INSERT INTO visa_rule_source_snapshots (id,source_id,retrieved_at,fingerprint_sha256,content_reference,retrieval_status) VALUES (?,1,UTC_TIMESTAMP(),REPEAT('b',64),'synthetic://source/1','SUCCESS')", [ids.sourceSnapshot]);
  await pool.query("INSERT INTO visa_rule_sets (id,stable_id,route_code,profile_code) VALUES (1,'SYN-RULE','30-days','BASE')");

  await rejectsSql(() => pool.query("INSERT INTO visa_rule_versions (id,rule_set_id,version,status,classification,research_status,source_snapshot_id,effective_from,conditions_json,outcome_json,created_by) VALUES ('synthetic-illegal-active',1,99,'ACTIVE','OFFICIAL','VALIDATED',?,UTC_TIMESTAMP(),JSON_OBJECT(),JSON_OBJECT(),'synthetic-import')", [ids.sourceSnapshot]), /cannot be imported directly as ACTIVE/);
  await pool.query("INSERT INTO visa_rule_versions (id,rule_set_id,version,status,classification,research_status,source_snapshot_id,effective_from,conditions_json,outcome_json,created_by) VALUES (?,1,1,'DRAFT','OFFICIAL','VALIDATED',?,UTC_TIMESTAMP(),JSON_OBJECT('nationality','EG'),JSON_OBJECT('state','ELIGIBLE'),'synthetic-owner')", [ids.ruleV1, ids.sourceSnapshot]);
  await rejectsSql(() => pool.query("UPDATE visa_rule_versions SET status='ACTIVE' WHERE id=?", [ids.ruleV1]), /Approved rule review is required/);
  await pool.query("INSERT INTO visa_rule_reviews (id,rule_version_id,decision,reviewer_reference,comment) VALUES (?,?,'APPROVED','synthetic-owner','Synthetic approval')", [ids.reviewV1, ids.ruleV1]);
  await pool.query("UPDATE visa_rule_versions SET status='ACTIVE' WHERE id=?", [ids.ruleV1]);
  await rejectsSql(() => pool.query("UPDATE visa_rule_versions SET conditions_json=JSON_OBJECT('tampered',true) WHERE id=?", [ids.ruleV1]), /Rule version evidence is immutable/);
  report.ruleGovernance = "PASS";

  await pool.query("INSERT INTO visa_rule_evaluation_runs (id,application_id,applicant_id,route_code,engine_version,final_eligibility_state,decision_reason,manual_review_reason,reevaluation_reason,required_documents_json,conditional_documents_json,warnings_json,precedence_trace_json,supersedes_evaluation_id,evidence_sha256,evaluated_at) VALUES (?,1,1,'30-days','synthetic-v1','ELIGIBLE','Synthetic evaluation',NULL,NULL,JSON_ARRAY('passport'),JSON_ARRAY(),JSON_ARRAY(),JSON_ARRAY('BASE_ROUTE'),NULL,REPEAT('c',64),UTC_TIMESTAMP())", [ids.evaluationV1]);
  await pool.query("INSERT INTO visa_rule_evaluation_matches (evaluation_id,sequence_number,rule_version_id,stable_rule_id,rule_version_number,rule_layer,classification,source_authority,match_reason) VALUES (?,1,?,'SYN-RULE',1,'BASE_ROUTE','OFFICIAL','Synthetic Authority','Synthetic match')", [ids.evaluationV1, ids.ruleV1]);
  await pool.query("INSERT INTO visa_rule_evaluation_selections (id,application_id,applicant_id,evaluation_id,selection_reason,selected_by,selected_at) VALUES ('synthetic-selection-v1',1,1,?,'Initial synthetic evaluation','synthetic-system',UTC_TIMESTAMP())", [ids.evaluationV1]);
  await pool.query("INSERT INTO visa_rule_versions (id,rule_set_id,version,status,classification,research_status,source_snapshot_id,effective_from,conditions_json,outcome_json,created_by) VALUES (?,1,2,'DRAFT','OFFICIAL','VALIDATED',?,UTC_TIMESTAMP(),JSON_OBJECT('nationality','EG'),JSON_OBJECT('state','HUMAN_REVIEW_REQUIRED'),'synthetic-owner')", [ids.ruleV2, ids.sourceSnapshot]);
  await pool.query("INSERT INTO visa_rule_reviews (id,rule_version_id,decision,reviewer_reference,comment) VALUES (?,?,'APPROVED','synthetic-owner','Synthetic v2 approval')", [ids.reviewV2, ids.ruleV2]);
  await pool.query("UPDATE visa_rule_versions SET status='ACTIVE' WHERE id=?", [ids.ruleV2]);
  await pool.query("INSERT INTO visa_rule_evaluation_runs (id,application_id,applicant_id,route_code,engine_version,final_eligibility_state,decision_reason,manual_review_reason,reevaluation_reason,required_documents_json,conditional_documents_json,warnings_json,precedence_trace_json,supersedes_evaluation_id,evidence_sha256,evaluated_at) VALUES (?,1,1,'30-days','synthetic-v2','HUMAN_REVIEW_REQUIRED','Synthetic rule update','Synthetic review required','Official rule version changed',JSON_ARRAY('passport'),JSON_ARRAY('supporting'),JSON_ARRAY(),JSON_ARRAY('BASE_ROUTE'),?,REPEAT('d',64),UTC_TIMESTAMP())", [ids.evaluationV2, ids.evaluationV1]);
  await pool.query("INSERT INTO visa_rule_evaluation_matches (evaluation_id,sequence_number,rule_version_id,stable_rule_id,rule_version_number,rule_layer,classification,source_authority,match_reason) VALUES (?,1,?,'SYN-RULE',2,'BASE_ROUTE','OFFICIAL','Synthetic Authority','Synthetic v2 match')", [ids.evaluationV2, ids.ruleV2]);
  await pool.query("INSERT INTO visa_rule_evaluation_selections (id,application_id,applicant_id,evaluation_id,selection_reason,selected_by,selected_at) VALUES ('synthetic-selection-v2',1,1,?,'Official rule changed','synthetic-manager',DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 SECOND))", [ids.evaluationV2]);
  await rejectsSql(() => pool.query("UPDATE visa_rule_evaluation_runs SET decision_reason='tampered' WHERE id=?", [ids.evaluationV1]), /append-only/);
  const [[evaluationHistory]] = await pool.query("SELECT COUNT(*) count, COUNT(DISTINCT engine_version) versions FROM visa_rule_evaluation_runs WHERE applicant_id=1");
  assert.deepEqual([Number(evaluationHistory.count), Number(evaluationHistory.versions)], [2, 2]);
  report.evaluationImmutability = "PASS";

  for (const [id, fromId, toId, relationship] of [["synthetic-rel-1",1,2,"SPOUSE"],["synthetic-rel-2",1,3,"CHILD"],["synthetic-rel-3",1,4,"CHILD"]]) {
    await pool.query("INSERT INTO family_relationship_events (id,application_id,from_applicant_id,to_applicant_id,relationship_type,event_type,reason,actor_reference,occurred_at) VALUES (?,1,?,?,?,'ESTABLISHED','Synthetic family graph','synthetic-system',UTC_TIMESTAMP())", [id, fromId, toId, relationship]);
  }
  await pool.query("INSERT INTO applicant_requirement_instances (id,application_id,applicant_id,evaluation_id,catalog_version,requirement_code,requirement_kind,critical,conditional) VALUES ('synthetic-req-a',1,1,?,'synthetic-v1','passport','DOCUMENT',true,false),('synthetic-req-b',1,2,?,'synthetic-v1','photo','DOCUMENT',true,false)", [ids.evaluationV2, ids.evaluationV1]);
  await pool.query("INSERT INTO applicant_requirement_events (id,requirement_instance_id,state,reason,actor_reference,occurred_at) VALUES ('synthetic-req-event-a','synthetic-req-a','VALIDATED','Synthetic accepted document','synthetic-reviewer',UTC_TIMESTAMP()),('synthetic-req-event-b','synthetic-req-b','MISSING','Synthetic missing document','synthetic-system',UTC_TIMESTAMP())");
  const [[isolation]] = await pool.query("SELECT COUNT(DISTINCT applicant_id) applicants, COUNT(DISTINCT evaluation_id) evaluations FROM applicant_requirement_instances WHERE application_id=1");
  assert.deepEqual([Number(isolation.applicants), Number(isolation.evaluations)], [2, 2]);
  report.familyAndRequirementIsolation = "PASS";

  await pool.query("INSERT INTO operations_case_controls (application_id,version,assigned_staff_user_id,team_id) VALUES (1,7,1,1)");
  const [[financeBefore]] = await pool.query("SELECT supplier_cost_aed FROM applications WHERE id=1");
  await transaction(async (connection) => {
    const [version] = await connection.query("UPDATE operations_case_controls SET version=version+1 WHERE application_id=1 AND version=7");
    assert.equal(version.affectedRows, 1);
    await connection.query("INSERT INTO operations_action_events (id,application_id,action_type,actor_reference,outcome,reason,entity_version_before,entity_version_after,correlation_id) VALUES ('synthetic-action-1',1,'HUMAN_REVIEW','staff:1','APPROVED_FOR_NEXT_STEP','Synthetic evidence reviewed',7,8,'synthetic-correlation-1')");
    await connection.query("INSERT INTO operations_audit_events (id,event_type,actor_type,actor_reference,resource_type,resource_reference,outcome,reason_code,metadata_json) VALUES ('synthetic-audit-1','HUMAN_REVIEW','STAFF','staff:1','APPLICATION','1','SUCCESS','APPROVED_FOR_NEXT_STEP',JSON_OBJECT('actionEventId','synthetic-action-1'))");
    await connection.query("INSERT INTO operations_idempotency_records (application_id,idempotency_key,command_hash,action_event_id,result_json) VALUES (1,'synthetic-idempotency-1',REPEAT('e',64),'synthetic-action-1',JSON_OBJECT('version',8,'auditEventId','synthetic-audit-1'))");
  });
  const stale = await transaction(async (connection) => {
    const [version] = await connection.query("UPDATE operations_case_controls SET version=version+1 WHERE application_id=1 AND version=7");
    return version.affectedRows;
  });
  assert.equal(stale, 0);
  const [[replay]] = await pool.query("SELECT command_hash,result_json FROM operations_idempotency_records WHERE application_id=1 AND idempotency_key='synthetic-idempotency-1'");
  assert.equal(replay.command_hash, "e".repeat(64));
  await rejectsSql(() => pool.query("INSERT INTO operations_idempotency_records (application_id,idempotency_key,command_hash,action_event_id,result_json) VALUES (1,'synthetic-idempotency-1',REPEAT('f',64),'synthetic-action-conflict',JSON_OBJECT())"), /Duplicate entry/);
  await rejectsSql(() => transaction(async (connection) => {
    const [version] = await connection.query("UPDATE operations_case_controls SET version=version+1 WHERE application_id=1 AND version=8");
    assert.equal(version.affectedRows, 1);
    await connection.query("INSERT INTO operations_action_events (id,application_id,action_type,actor_reference,outcome,reason,entity_version_before,entity_version_after,correlation_id) VALUES ('synthetic-action-rollback',1,'DOCUMENT_REVIEW','staff:1','ACCEPTED','Synthetic rollback test',8,9,'synthetic-correlation-rollback')");
    await connection.query("INSERT INTO operations_audit_events (id,event_type,actor_type,actor_reference,resource_type,resource_reference,outcome) VALUES ('synthetic-audit-1','DOCUMENT_REVIEW','STAFF','staff:1','DOCUMENT','1','SUCCESS')");
  }), /Duplicate entry/);
  const [[atomicity]] = await pool.query("SELECT (SELECT version FROM operations_case_controls WHERE application_id=1) version, (SELECT COUNT(*) FROM operations_action_events WHERE id='synthetic-action-rollback') rolledBackEvents");
  assert.deepEqual([Number(atomicity.version), Number(atomicity.rolledBackEvents)], [8, 0]);
  const [[financeAfter]] = await pool.query("SELECT supplier_cost_aed FROM applications WHERE id=1");
  assert.equal(financeAfter.supplier_cost_aed, financeBefore.supplier_cost_aed);
  report.controlledWrites = "PASS";
  report.concurrency = "PASS";
  report.idempotency = "PASS";
  report.auditAtomicity = "PASS";
  report.financeIsolation = "PASS";

  console.log(JSON.stringify({ target: { host: target.hostname, port: target.port, database: target.pathname.slice(1), remote: false }, report }, null, 2));
} finally {
  await pool.end();
}
