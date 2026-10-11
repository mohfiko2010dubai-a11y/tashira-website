import {createHash,randomUUID} from 'node:crypto';
import type {Pool,RowDataPacket} from 'mysql2/promise';
import {MysqlOperationsAccessProvider} from './mysql-access-provider';
import {authorize} from '../authorization/policy';
import {recipientHash} from '../resend-email';
import {renderTransactionalEmail} from '../transactional-email';

export type SupportReplyCommand={commandId:string;expectedVersion:number;body:string;actorStaffId:number};
export type SupportOutgoingEmail={commandId:string;body:string;status:string;attempts:number;createdAt:string};

export async function queueSupportEmail(pool:Pool,threadId:string,input:SupportReplyCommand){
  const body=input.body.trim();
  if(!body||body.length>4000||!Number.isSafeInteger(input.actorStaffId)||input.actorStaffId<=0)throw new Error('SUPPORT_REPLY_INVALID');
  const connection=await pool.getConnection();
  try{
    await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await connection.beginTransaction();
    const [links]=await connection.execute<RowDataPacket[]>('SELECT application_id FROM operations_support_threads WHERE id=?',[threadId]);
    const applicationId=Number(links[0]?.application_id);
    if(!Number.isSafeInteger(applicationId)||applicationId<=0)throw new Error('SUPPORT_REPLY_APPLICATION_REQUIRED');
    const [apps]=await connection.execute<RowDataPacket[]>('SELECT contact_email,reference_number,preferred_language FROM applications WHERE id=? FOR UPDATE',[applicationId]);
    const [controls]=await connection.execute<RowDataPacket[]>('SELECT assigned_staff_user_id FROM operations_case_controls WHERE application_id=? FOR UPDATE',[applicationId]);
    const [threads]=await connection.execute<RowDataPacket[]>('SELECT application_id,version FROM operations_support_threads WHERE id=? FOR UPDATE',[threadId]);
    if(!apps[0]||!threads[0]||Number(threads[0].application_id)!==applicationId)throw new Error('SUPPORT_ACCESS_DENIED');
    const access=new MysqlOperationsAccessProvider({async query(sql,params=[]){const [rows]=await connection.execute<RowDataPacket[]>(sql,[...params]);return rows;}});
    const actor=await access.refreshTrustedActor(`staff:${input.actorStaffId}`);
    const owner=controls[0]?.assigned_staff_user_id==null?undefined:`staff:${Number(controls[0].assigned_staff_user_id)}`;
    const allowed=actor.scopes.includes('ALL')?actor.permissions.has('support.reply')
      :owner===actor.id&&authorize(actor,'case.transition',{assignedActorId:owner}).allowed;
    if(!allowed)throw new Error('SUPPORT_ACCESS_DENIED');
    const hash=createHash('sha256').update(JSON.stringify({threadId,...input,body})).digest('hex');
    const [prior]=await connection.execute<RowDataPacket[]>('SELECT command_sha256 FROM operations_support_email_requests WHERE command_id=? FOR UPDATE',[input.commandId]);
    if(prior[0]){
      if(prior[0].command_sha256!==hash)throw new Error('SUPPORT_COMMAND_IDEMPOTENCY_CONFLICT');
      await connection.commit();return {queued:true as const,replayed:true};
    }
    if(Number(threads[0].version)!==input.expectedVersion)throw new Error('SUPPORT_THREAD_VERSION_CONFLICT');
    const variables={replyText:body,recipientHash:recipientHash(String(apps[0].contact_email))};
    // Validate and escape through the same renderer used by the real sender before accepting the job.
    renderTransactionalEmail('SUPPORT_REPLY',{...variables,referenceNumber:String(apps[0].reference_number),language:String(apps[0].preferred_language)});
    const jobKey=`support-reply:${input.commandId}`;
    await connection.execute(`INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json) VALUES (?,?,'SUPPORT_REPLY',?)`,[jobKey,applicationId,JSON.stringify(variables)]);
    await connection.execute(`INSERT INTO operations_support_email_requests(command_id,thread_id,application_id,actor_staff_id,command_sha256,body,job_key) VALUES (?,?,?,?,?,?,?)`,[input.commandId,threadId,applicationId,input.actorStaffId,hash,body,jobKey]);
    await connection.execute('UPDATE operations_support_threads SET version=version+1,updated_at=NOW() WHERE id=?',[threadId]);
    await connection.execute(`INSERT INTO operations_audit_events(id,event_type,actor_type,actor_reference,resource_type,resource_reference,outcome,reason_code,metadata_json) VALUES (?,'SUPPORT_REPLY_QUEUED','STAFF',?,'SUPPORT_THREAD',?,'SUCCESS','CUSTOMER_EMAIL_REPLY',?)`,[randomUUID(),actor.id,threadId,JSON.stringify({commandId:input.commandId,jobKey})]);
    await connection.commit();return {queued:true as const,replayed:false};
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}
