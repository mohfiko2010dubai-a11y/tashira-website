import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { transformSync } from 'esbuild';
import { verifyPhase2Mysql } from './verify-phase2-mysql.mjs';
const raw = process.env.OPS_REHEARSAL_DATABASE_URL;
if (!raw) throw new Error('Disposable integration database URL required');
const target = new URL(raw);
if (target.protocol !== 'mysql:' || !['127.0.0.1','localhost'].includes(target.hostname) || target.port !== '33306'
  || !/^\/tashira_ops_rehearsal_[a-z0-9_]+$/.test(target.pathname)) throw new Error('Refusing non-rehearsal database');
// Complete the minimal historical Operations fixture with current prerequisites.
// These are the actual migrations, executed only in the guarded disposable DB.
const parserCode=transformSync(readFileSync('api/lib/operations/mysql-rehearsal-runner.ts','utf8'),{loader:'ts',format:'esm'}).code;
const {parseMysqlClientScript}=await import('data:text/javascript;base64,'+Buffer.from(parserCode).toString('base64'));
const db=await mysql.createConnection(raw);
try {
  await db.query('ALTER TABLE applications ADD COLUMN invoice_pdf_url varchar(500) NULL');
  await db.query('ALTER TABLE invoices ADD COLUMN vat_rate decimal(7,4) NOT NULL DEFAULT 0');
  await db.query('ALTER TABLE applicants ADD COLUMN gcc_residence_country varchar(100) NULL');
  await db.query('ALTER TABLE applicants ADD COLUMN sponsor_name varchar(255) NULL, ADD COLUMN sponsor_relation varchar(100) NULL');
  await db.query("ALTER TABLE documents ADD COLUMN storage_provider varchar(50) NOT NULL DEFAULT 'filesystem', ADD COLUMN storage_bucket varchar(100) NULL");
  for(const file of ['005_business_architecture.sql','008_email_template_evidence.sql','009_application_data_classification.sql','010_refunds_and_security_deposits.sql','011_security_deposit_email.sql','012_refund_email_evidence.sql','013_refund_email_append_only_idempotency.sql',
    '046_checkout_quote_revisions.sql','051_checkout_payment_attempts.sql','055_product_availability.sql','056_processing_guarantee.sql','057_nationality_availability.sql','059_company_policy_settings.sql','060_nationality_product_rules.sql','061_submission_and_stripe_fee.sql','062_named_staff_security.sql','063_refund_queue.sql','064_transactional_email.sql']) {
    for(const statement of parseMysqlClientScript(readFileSync('migrations/'+file,'utf8'))) await db.query(statement);
  }
  await db.query("UPDATE applications SET data_classification='TEST'");
  await verifyPhase2Mysql(db);
  // Exercise the real trigger in the disposable database, then restore fixtures.
  await db.beginTransaction();
  try {
    await db.query("UPDATE applications SET visa_type='SOLD_TEST',submitted_product='SUBMITTED_TEST',substitution_version=1,substitution_acknowledged_version=NULL,status='under_review' WHERE id=2");
    let refused = false;
    try { await db.query("UPDATE applications SET status='visa_processing' WHERE id=2"); }
    catch (error) { if (error.sqlState !== '45000' || !error.message.includes('acknowledgement')) throw error; refused = true; }
    if (!refused) throw new Error('Missing customer acknowledgement did not prevent filing');
    await db.query("UPDATE applications SET substitution_acknowledged_version=1,substitution_acknowledged_at=NOW(3) WHERE id=2");
    await db.query("UPDATE applications SET status='visa_processing' WHERE id=2");
    console.log('Substitution filing trigger: refused before consent, accepted exact-version consent.');
  } finally { await db.rollback(); }
  await db.query("INSERT INTO visa_product_availability (service_code,is_active) VALUES ('ROUTE_TEST',1)");
  await db.query(`INSERT INTO pricing_rules (service_code,pricing_processing_type,version,supplier_cost,internal_cost,markup,selling_price,
    minimum_selling_price,pricing_currency,effective_at,created_by) VALUES ('ROUTE_TEST','regular',1,40,10,50,100,100,'USD','2020-01-01','synthetic-ci')`);
  await db.query(`INSERT INTO business_settings_versions (settings_version,legal_name,company_address,company_phone,company_email,vat_registered,
    settings_vat_rate,warning_levels_json,invoice_prefix,next_invoice_number,base_currency,usd_to_base_rate,settings_effective_at,settings_created_by)
    VALUES (1,'Synthetic CI','Synthetic','000','ci@example.invalid','no',0,'[]','TEST',1,'AED',3.67,'2020-01-01','synthetic-ci')`);
  const group=randomUUID();
  await db.execute(`INSERT INTO travel_groups (id,application_id,travel_group_reference,arrangement,primary_traveller_id,origin,destination,planned_arrival_date)
    VALUES (?,2,'CI-SCHEDULER','TOGETHER',5,'SYNTHETIC','SYNTHETIC','2027-01-20')`,[group]);
  await db.execute(`INSERT INTO submission_schedule_snapshots
    (id,application_id,travel_group_id,route_code,planned_arrival_date,schedule_state,reason,blocking_reasons_json,rule_versions_json,
     matched_rule_ids_json,source_evidence_references_json,recalculation_reason,evaluator_version,evidence_sha256,evaluated_at)
    VALUES (?,2,?,'SYNTHETIC','2027-01-20','SCHEDULED_FOR_SUBMISSION','Synthetic CI fixture','[]','[]','[]','[]','Synthetic CI fixture','synthetic-v1',?,UTC_TIMESTAMP())`,
    [randomUUID(),group,'a'.repeat(64)]);
} finally {await db.end();}
const keys = ['DATABASE_URL','OPS_EXECUTOR_DATABASE_URL','DOCUMENT_INTELLIGENCE_MYSQL_URL','CUSTOMER_WRITE_REHEARSAL_DATABASE_URL',
  'INTERVIEW_EVALUATION_REHEARSAL_DATABASE_URL','INTERVIEW_ANSWER_REHEARSAL_DATABASE_URL','OPS_REHEARSAL_DATABASE_URL',
  'OPS_READ_DATABASE_URL','OPS_SUPPLIER_SLA_DATABASE_URL','OPS_SUPPORT_DATABASE_URL','SCHEDULER_ALERT_MYSQL_URL'];
const env = {...process.env, RUN_DOCUMENT_INTELLIGENCE_MYSQL_INTEGRATION:'1',RUN_SCHEDULER_ALERT_MYSQL_INTEGRATION:'1'};
for (const key of keys) env[key] = raw;
function find(dir) { return readdirSync(dir,{withFileTypes:true}).flatMap(entry => {
  const file=path.join(dir,entry.name);
  return entry.isDirectory()?find(file):entry.name.endsWith('.integration.test.ts')?[file]:[];
}); }
const files=find('api');
if (files.length !== 11) throw new Error('Integration inventory changed; review the expected suite');
const report='mysql-integration-results.json';
const result=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',...files,'--no-file-parallelism','--reporter=default','--reporter=json','--outputFile='+report],{env,stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);
const summary=JSON.parse(readFileSync(report,'utf8'));
if(summary.numPassedTests!==26 || summary.numPendingTests!==0 || summary.numFailedTests!==0) throw new Error('All26 integration tests must execute and pass; skips fail CI');
console.log('All26 guarded MySQL integration tests passed, zero skipped.');
