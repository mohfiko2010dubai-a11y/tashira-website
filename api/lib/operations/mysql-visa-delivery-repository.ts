import type { VisaFileEvidence } from "./visa-file-evidence";
import { randomUUID } from "node:crypto";
import { authorize } from "../authorization/policy";
import { MysqlOperationsAccessProvider } from "./mysql-access-provider";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { prepareVisaDelivery, type VisaDeliveryPackage } from "./visa-delivery";
import type { ApplicationStatus } from "./controlled-write-repository";

type SqlValue = string | number | Date | null;
export type VisaDeliveryResource = { applicationId: number; applicationReference: string; teamId?: number; departmentId?: number; assignedActorId?: string; applicationStatus: ApplicationStatus; paymentStatus: string };
export type PrepareVisaDeliveryCommand = { applicationReference: string; applicantId: number; visaDocumentId: number; visaReference: string; validitySummary: string; customerInstructions: readonly string[]; commandId: string; actorReference: string; preparedAt: string };
export type VisaDeliveryView = Pick<VisaDeliveryPackage, "deliveryId"|"applicationId"|"applicantId"|"visaDocumentId"|"generatedAt"|"visaReference"|"validitySummary"|"customerInstructions"|"state"|"integritySha256">;
export type VisaDeliveryDocument = { delivery: VisaDeliveryView; storagePath: string; fileEvidence: VisaFileEvidence };

function value(row: object, key: string): unknown { return Reflect.get(row, key); }
function text(row: object, key: string): string { const item=value(row,key); if(typeof item!=="string") throw new Error(`VISA_DELIVERY_ROW_INVALID:${key}`); return item; }
function integer(row: object, key: string): number { const item=Number(value(row,key)); if(!Number.isSafeInteger(item)||item<=0) throw new Error(`VISA_DELIVERY_ROW_INVALID:${key}`); return item; }
function dateTime(row: object,key:string):string { const item=value(row,key); if(item instanceof Date)return item.toISOString(); if(typeof item==="string"&&!Number.isNaN(Date.parse(item)))return new Date(item).toISOString(); throw new Error(`VISA_DELIVERY_ROW_INVALID:${key}`); }
function json<T>(row: object,key:string):T { const item=value(row,key); if(typeof item==="string")return JSON.parse(item) as T; if(Buffer.isBuffer(item))return JSON.parse(item.toString("utf8")) as T; return item as T; }
async function rows(connection:PoolConnection,sql:string,params:readonly SqlValue[]=[]):Promise<RowDataPacket[]> { const [result]=await connection.execute<RowDataPacket[]>(sql,[...params]); return result; }
const resourceSelect="SELECT a.id applicationId,a.reference_number applicationReference,a.status applicationStatus,a.payment_status paymentStatus,c.team_id teamId,t.department_id departmentId,c.assigned_staff_user_id assignedStaffId FROM applications a LEFT JOIN operations_case_controls c ON c.application_id=a.id LEFT JOIN operations_teams t ON t.id=c.team_id";
const deliverySelect="SELECT d.id deliveryId,d.application_id applicationId,d.applicant_id applicantId,d.visa_document_id visaDocumentId,d.prepared_at generatedAt,d.visa_reference visaReference,d.validity_summary validitySummary,d.customer_instructions_json customerInstructions,d.state,d.integrity_sha256 integritySha256 FROM operations_visa_deliveries d JOIN applications a ON a.id=d.application_id";

const fileSelect="SELECT d.id deliveryId,d.application_id applicationId,d.applicant_id applicantId,d.visa_document_id visaDocumentId,d.prepared_at generatedAt,d.visa_reference visaReference,d.validity_summary validitySummary,d.customer_instructions_json customerInstructions,d.state,d.integrity_sha256 integritySha256,a.reference_number applicationReference,f.storage_path storagePath,f.content_sha256 contentSha256,f.byte_length byteLength,f.mime_type mimeType,f.engine_version engineVersion,f.database_version databaseVersion,f.scanned_at scannedAt FROM operations_visa_deliveries d JOIN applications a ON a.id=d.application_id JOIN documents doc ON doc.id=d.visa_document_id JOIN operations_document_security_scans s ON s.id=d.security_scan_id JOIN operations_visa_file_evidence f ON f.scan_id=s.id";
const safeFileConditions="AND doc.application_id=d.application_id AND doc.applicant_id=d.applicant_id AND doc.document_type='visa' AND doc.upload_status='uploaded' AND s.result='PASSED' AND NOT EXISTS (SELECT 1 FROM operations_document_security_scans newer WHERE newer.document_id=doc.id AND newer.scanned_at>=s.scanned_at AND newer.result<>'PASSED')";

export class MysqlVisaDeliveryRepository {
  private readonly pool: Pool;
  private readonly captureFile?: (sourcePath: string) => Promise<VisaFileEvidence>;
  private readonly discardFile?: (evidence: VisaFileEvidence) => Promise<void>;
  constructor(pool: Pool, captureFile?: (sourcePath: string) => Promise<VisaFileEvidence>, discardFile?: (evidence: VisaFileEvidence) => Promise<void>) { this.pool = pool; this.captureFile=captureFile; this.discardFile=discardFile; }
  async context(reference:string):Promise<VisaDeliveryResource|null>{const connection=await this.pool.getConnection();try{const found=await rows(connection,`${resourceSelect} WHERE a.reference_number=?`,[reference]);return found[0]?{applicationId:integer(found[0],"applicationId"),applicationReference:text(found[0],"applicationReference"),teamId:found[0].teamId == null ? undefined : integer(found[0],"teamId"),departmentId:found[0].departmentId == null ? undefined : integer(found[0],"departmentId"),assignedActorId:found[0].assignedStaffId == null ? undefined : `staff:${integer(found[0],"assignedStaffId")}`,applicationStatus:text(found[0],"applicationStatus") as ApplicationStatus,paymentStatus:text(found[0],"paymentStatus")}:null;}finally{connection.release();}}
  async listForCustomer(reference:string):Promise<readonly VisaDeliveryView[]>{const connection=await this.pool.getConnection();try{return (await rows(connection,`${deliverySelect} WHERE a.reference_number=? ORDER BY d.prepared_at,d.id`,[reference])).map((row)=>this.view(row));}finally{connection.release();}}
  async documentForCustomer(reference:string,deliveryId:string):Promise<VisaDeliveryDocument|null>{
    const connection=await this.pool.getConnection();try{
      const found=await rows(connection,`${fileSelect} WHERE a.reference_number=? AND d.id=? ${safeFileConditions}`,[reference,deliveryId]);
      return found[0]?this.fileView(found[0]):null;
    }finally{connection.release();}
  }
  async documentByArchivePath(storagePath:string):Promise<(VisaDeliveryDocument & { applicationReference:string })|null>{
    const connection=await this.pool.getConnection();try{
      const found=await rows(connection,`${fileSelect} WHERE f.storage_path=? ${safeFileConditions}`,[storagePath]);
      return found[0]?{...this.fileView(found[0]),applicationReference:text(found[0],"applicationReference")}:null;
    }finally{connection.release();}
  }
  private fileView(row:object):VisaDeliveryDocument {
    const evidence:VisaFileEvidence={storagePath:text(row,"storagePath"),contentSha256:text(row,"contentSha256"),byteLength:integer(row,"byteLength"),mimeType:text(row,"mimeType") as VisaFileEvidence["mimeType"],engineVersion:text(row,"engineVersion"),databaseVersion:text(row,"databaseVersion"),scannedAt:dateTime(row,"scannedAt")};
    return {delivery:this.view(row),storagePath:evidence.storagePath,fileEvidence:evidence};
  }
  async prepare(input:PrepareVisaDeliveryCommand):Promise<VisaDeliveryView>{const connection=await this.pool.getConnection();let capturedFile:VisaFileEvidence|undefined;let commitAttempted=false;try{await connection.beginTransaction();
    // Assignment and delivery share the application-first lock order. Recheck
    // the current assignee and current grants inside the transaction, including retries.
    const application=await rows(connection,"SELECT id FROM applications WHERE reference_number=? FOR UPDATE",[input.applicationReference]);
    if(!application[0])throw new Error("VISA_DELIVERY_ACCESS_DENIED");
    const scope=await rows(connection,`${resourceSelect} WHERE a.id=? FOR UPDATE`,[integer(application[0],"id")]);
    const current=scope[0];
    const access=new MysqlOperationsAccessProvider({query:async(sql,parameters=[])=>{const [result]=await connection.execute<RowDataPacket[]>(sql,[...parameters]);return result;}});
    const actor=await access.refreshTrustedActor(input.actorReference);
    if(!current||!authorize(actor,"document.review",{
      assignedActorId:current.assignedStaffId==null?undefined:`staff:${integer(current,"assignedStaffId")}`,
      teamId:current.teamId==null?undefined:integer(current,"teamId"),departmentId:current.departmentId==null?undefined:integer(current,"departmentId"),
    }).allowed)throw new Error("VISA_DELIVERY_ACCESS_DENIED");
    const replay=await rows(connection,`${deliverySelect} WHERE a.reference_number=? AND (d.idempotency_key=? OR d.visa_document_id=?) FOR UPDATE`,[input.applicationReference,input.commandId,input.visaDocumentId]);if(replay.length>1)throw new Error("VISA_DELIVERY_IDEMPOTENCY_CONFLICT");if(replay[0]){const prior=this.view(replay[0]);if(prior.applicantId!==input.applicantId||prior.visaDocumentId!==input.visaDocumentId||prior.visaReference!==input.visaReference||prior.validitySummary!==input.validitySummary||JSON.stringify(prior.customerInstructions)!==JSON.stringify(input.customerInstructions))throw new Error("VISA_DELIVERY_IDEMPOTENCY_CONFLICT");await connection.commit();return prior;}
    if (this.captureFile) {
      if(text(current,"applicationStatus")!=="visa_received"||text(current,"paymentStatus")!=="paid")throw new Error("VISA_DELIVERY_APPLICATION_STATE_REQUIRED");
      const document=await rows(connection,"SELECT storage_path storagePath FROM documents WHERE id=? AND application_id=? AND applicant_id=? AND document_type='visa' AND upload_status='uploaded' FOR UPDATE",[input.visaDocumentId,integer(current,"applicationId"),input.applicantId]);
      if(!document[0])throw new Error("VISA_DELIVERY_OWNERSHIP_OR_SCAN_REQUIRED");
      const file=await this.captureFile(text(document[0],"storagePath"));
      capturedFile=file;
      const scanId=randomUUID();
      await connection.execute("INSERT INTO operations_document_security_scans(id,document_id,application_id,applicant_id,provider_code,provider_reference,engine_version,result,evidence_sha256,scanned_at,recorded_by) VALUES (?,?,?,?,'clamd-local-v1',?,?,'PASSED',?,?,?)",[scanId,input.visaDocumentId,integer(current,"applicationId"),input.applicantId,scanId,file.engineVersion,file.contentSha256,new Date(file.scannedAt),input.actorReference]);
      await connection.execute("INSERT INTO operations_visa_file_evidence(scan_id,storage_path,content_sha256,byte_length,mime_type,engine_version,database_version,scanned_at) VALUES (?,?,?,?,?,?,?,?)",[scanId,file.storagePath,file.contentSha256,file.byteLength,file.mimeType,file.engineVersion,file.databaseVersion,new Date(file.scannedAt)]);
    }
    const evidence=await rows(connection,`SELECT a.id applicationId,a.reference_number applicationReference,a.status applicationStatus,a.payment_status paymentStatus,ap.id applicantId,doc.id visaDocumentId,s.id scanId,s.evidence_sha256 scanEvidence,f.storage_path archivePath FROM applications a JOIN applicants ap ON ap.application_id=a.id AND ap.id=? JOIN documents doc ON doc.application_id=a.id AND doc.applicant_id=ap.id AND doc.id=? AND doc.document_type='visa' AND doc.upload_status='uploaded' JOIN operations_document_security_scans s ON s.document_id=doc.id AND s.application_id=a.id AND s.applicant_id=ap.id LEFT JOIN operations_visa_file_evidence f ON f.scan_id=s.id WHERE a.reference_number=? ORDER BY s.scanned_at DESC,s.created_at DESC LIMIT 1 FOR UPDATE`,[input.applicantId,input.visaDocumentId,input.applicationReference]);if(!evidence[0])throw new Error("VISA_DELIVERY_OWNERSHIP_OR_SCAN_REQUIRED");const latest=evidence[0];if(text(latest,"applicationStatus")!=="visa_received"||text(latest,"paymentStatus")!=="paid")throw new Error("VISA_DELIVERY_APPLICATION_STATE_REQUIRED");const passed=await rows(connection,"SELECT result FROM operations_document_security_scans WHERE document_id=? AND scanned_at >= (SELECT scanned_at FROM operations_document_security_scans WHERE id=?)",[input.visaDocumentId,text(latest,"scanId")]);if(!passed.length||passed.some(scan=>text(scan,"result")!=="PASSED"))throw new Error("VISA_DELIVERY_SCAN_NOT_PASSED");
    if(!value(latest,"archivePath"))throw new Error("VISA_DELIVERY_FILE_EVIDENCE_REQUIRED");
    // prepared_at is DATETIME(0): canonicalize before hashing and persisting.
    const preparedAt=new Date(input.preparedAt);
    preparedAt.setUTCMilliseconds(0);
    const delivery=prepareVisaDelivery({deliveryId:randomUUID(),applicationId:integer(latest,"applicationId"),applicantId:integer(latest,"applicantId"),visaDocumentId:integer(latest,"visaDocumentId"),generatedAt:preparedAt.toISOString(),recipientReference:input.applicationReference,authorizedCustomer:true,virusScanPassed:true,documentOwnershipVerified:true,visaReference:input.visaReference,validitySummary:input.validitySummary,customerInstructions:input.customerInstructions,evidenceReferences:[`document:${input.visaDocumentId}`,`security-scan:${text(latest,"scanId")}`,`security-evidence:${text(latest,"scanEvidence")}`]});
    await connection.execute("INSERT INTO operations_visa_deliveries (id,application_id,applicant_id,visa_document_id,security_scan_id,recipient_reference,visa_reference,validity_summary,customer_instructions_json,evidence_references_json,state,integrity_sha256,prepared_by,idempotency_key,prepared_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[delivery.deliveryId,delivery.applicationId,delivery.applicantId,delivery.visaDocumentId,text(latest,"scanId"),delivery.recipientReference,delivery.visaReference,delivery.validitySummary,JSON.stringify(delivery.customerInstructions),JSON.stringify(delivery.evidenceReferences),delivery.state,delivery.integritySha256,input.actorReference,input.commandId,preparedAt]);
    await connection.execute("INSERT INTO operations_audit_events (id,event_type,actor_type,actor_reference,resource_type,resource_reference,outcome,reason_code,metadata_json) VALUES (?,'VISA_DELIVERY_PREPARED','STAFF',?,'VISA_DELIVERY',?,'SUCCESS','SECURITY_SCAN_PASSED',?)",[randomUUID(),input.actorReference,delivery.deliveryId,JSON.stringify({applicationId:delivery.applicationId,applicantId:delivery.applicantId,documentId:delivery.visaDocumentId})]);commitAttempted=true;await connection.commit();return this.view({...delivery,generatedAt:delivery.generatedAt});
  }catch(error){await connection.rollback();if(!commitAttempted&&capturedFile&&this.discardFile)await this.discardFile(capturedFile).catch(()=>undefined);throw error;}finally{connection.release();}}
  private view(row:object):VisaDeliveryView{return {deliveryId:text(row,"deliveryId"),applicationId:integer(row,"applicationId"),applicantId:integer(row,"applicantId"),visaDocumentId:integer(row,"visaDocumentId"),generatedAt:dateTime(row,"generatedAt"),visaReference:text(row,"visaReference"),validitySummary:text(row,"validitySummary"),customerInstructions:Array.isArray(value(row,"customerInstructions"))?value(row,"customerInstructions") as string[]:json<string[]>(row,"customerInstructions"),state:text(row,"state") as "READY_FOR_SECURE_DELIVERY",integritySha256:text(row,"integritySha256")};}
}
