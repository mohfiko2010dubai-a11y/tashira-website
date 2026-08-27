import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { AuthorizationActor } from "../authorization/policy";
import { validatePassportProfile, type PassportProfile } from "./contracts";
import { evaluatePassportProfileTransition, type PassportProfileAction, type PassportProfileState } from "./passport-profile-governance";

export type PassportProfileDraft = { profileCode: string; profile: Omit<PassportProfile, "profileId" | "lifecycle"> };
export type PassportProfileGovernanceResult = { profileId: string; profileCode: string; version: number; state: PassportProfileState; eventId: string; entityVersion: number };
export type PassportProfileGovernanceRecord = PassportProfileGovernanceResult & { profile: PassportProfile; fromState: PassportProfileState | null; actorReference: string; reason: string; occurredAt: string };

function sha(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function text(row: object, key: string): string | null { const value = Reflect.get(row, key); return typeof value === "string" ? value : null; }
function integer(row: object, key: string): number { const value = Number(Reflect.get(row,key)); if (!Number.isSafeInteger(value) || value < 1) throw new Error("PASSPORT_PROFILE_EVIDENCE_INVALID"); return value; }
function state(value: string | null): PassportProfileState { if (!value || !["DRAFT","UNDER_REVIEW","APPROVED","ACTIVE","SUPERSEDED","RETIRED"].includes(value)) throw new Error("PASSPORT_PROFILE_EVIDENCE_INVALID"); return value as PassportProfileState; }
function profileJson(row: object): PassportProfile { const value=Reflect.get(row,"profileJson"); const parsed:unknown=typeof value==="string"?JSON.parse(value):Buffer.isBuffer(value)?JSON.parse(value.toString("utf8")):value; return validatePassportProfile(parsed as PassportProfile); }

export class MysqlPassportProfileGovernanceRepository {
  readonly #pool: Pool;
  constructor(pool: Pool) { this.#pool=pool; }

  async importDraft(input: PassportProfileDraft, commandId: string, actor: AuthorizationActor, occurredAt: Date): Promise<PassportProfileGovernanceResult> {
    if (!actor.permissions.has("rule.propose")) throw new Error("PASSPORT_PROFILE_GOVERNANCE_ACCESS_DENIED");
    if (!input.profileCode.trim() || input.profileCode.length>128 || Number.isNaN(occurredAt.getTime())) throw new Error("PASSPORT_PROFILE_INPUT_INVALID");
    return this.#transaction(async connection=>{
      const payloadSha256=sha({kind:"IMPORT",input,actorId:actor.id}); const replay=await this.#replay(connection,commandId,payloadSha256); if(replay)return replay;
      const profileId=randomUUID(); const profile=validatePassportProfile({...input.profile,profileId,lifecycle:"DRAFT"});
      const [existing]=await connection.execute<RowDataPacket[]>("SELECT id FROM passport_profile_versions WHERE profile_code=? AND version=? FOR UPDATE",[input.profileCode,profile.version]);
      if(existing[0])throw new Error("PASSPORT_PROFILE_VERSION_EXISTS");
      await connection.execute(`INSERT INTO passport_profile_versions
        (id,profile_code,version,issuing_country,passport_type,layout_version,profile_json,profile_sha256,confidence_threshold,effective_from,effective_to,
         source_evidence_json,approval_state,staging_test_only,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'DRAFT',?,?,?)`,
      [profileId,input.profileCode,profile.version,profile.issuingCountry,profile.passportType,profile.layoutVersion,JSON.stringify(profile),sha(profile),profile.confidenceThreshold,
        new Date(profile.effectiveFrom),profile.effectiveTo?new Date(profile.effectiveTo):null,JSON.stringify(profile.sourceEvidenceReferences),profile.stagingTestOnly,actor.id,occurredAt]);
      await this.#event(connection,commandId,"PASSPORT_PROFILE",profileId,null,"DRAFT",actor.id,"PASSPORT_PROFILE_IMPORT",payloadSha256,occurredAt);
      return {profileId,profileCode:input.profileCode,version:profile.version,state:"DRAFT",eventId:commandId,entityVersion:1};
    });
  }

  async transition(input:{profileId:string;expectedState:PassportProfileState;expectedEntityVersion:number;action:PassportProfileAction;reason:string;commandId:string;
    environment:"DEVELOPMENT"|"TEST"|"STAGING"|"PRODUCTION";occurredAt:Date},actor:AuthorizationActor):Promise<PassportProfileGovernanceResult>{
    if(!input.reason.trim()||Number.isNaN(input.occurredAt.getTime())||!Number.isSafeInteger(input.expectedEntityVersion)||input.expectedEntityVersion<1)throw new Error("PASSPORT_PROFILE_INPUT_INVALID");
    return this.#transaction(async connection=>{
      const payloadSha256=sha({...input,occurredAt:input.occurredAt.toISOString(),actorId:actor.id});const replay=await this.#replay(connection,input.commandId,payloadSha256);if(replay)return replay;
      const [rows]=await connection.execute<RowDataPacket[]>(`SELECT p.profile_code profileCode,p.version,p.staging_test_only stagingTestOnly,e.to_status currentState,
        (SELECT COUNT(*) FROM document_intelligence_governance_events x WHERE x.entity_type='PASSPORT_PROFILE' AND x.entity_id=p.id) entityVersion
        FROM passport_profile_versions p JOIN document_intelligence_governance_events e ON e.id=(SELECT x.id FROM document_intelligence_governance_events x
        WHERE x.entity_type='PASSPORT_PROFILE' AND x.entity_id=p.id ORDER BY x.occurred_at DESC,x.id DESC LIMIT 1) WHERE p.id=? FOR UPDATE`,[input.profileId]);
      const row=rows[0];if(!row)throw new Error("PASSPORT_PROFILE_NOT_FOUND");const current=state(text(row,"currentState"));const entityVersion=integer(row,"entityVersion");
      if(current!==input.expectedState||entityVersion!==input.expectedEntityVersion)throw new Error("PASSPORT_PROFILE_VERSION_CONFLICT");
      const next=evaluatePassportProfileTransition({current,action:input.action,actorPermissions:actor.permissions,environment:input.environment,stagingTestOnly:Boolean(Reflect.get(row,"stagingTestOnly"))});
      if(next==="ACTIVE"){
        const [active]=await connection.execute<RowDataPacket[]>(`SELECT p.id FROM passport_profile_versions p JOIN document_intelligence_governance_events e ON e.id=(SELECT x.id
          FROM document_intelligence_governance_events x WHERE x.entity_type='PASSPORT_PROFILE' AND x.entity_id=p.id ORDER BY x.occurred_at DESC,x.id DESC LIMIT 1)
          WHERE p.profile_code=? AND p.id<>? AND e.to_status='ACTIVE' FOR UPDATE`,[text(row,"profileCode"),input.profileId]);
        if(active[0])throw new Error("PASSPORT_PROFILE_ACTIVE_CONFLICT");
      }
      await this.#event(connection,input.commandId,"PASSPORT_PROFILE",input.profileId,current,next,actor.id,input.reason.trim(),payloadSha256,input.occurredAt);
      return {profileId:input.profileId,profileCode:text(row,"profileCode")??"",version:integer(row,"version"),state:next,eventId:input.commandId,entityVersion:entityVersion+1};
    });
  }

  async list(actor:AuthorizationActor):Promise<readonly PassportProfileGovernanceRecord[]>{
    if(!actor.permissions.has("rule.read"))throw new Error("PASSPORT_PROFILE_GOVERNANCE_ACCESS_DENIED");
    const [rows]=await this.#pool.execute<RowDataPacket[]>(`SELECT p.id profileId,p.profile_code profileCode,p.version,p.profile_json profileJson,e.id eventId,e.from_status fromState,e.to_status state,
      e.actor_reference actorReference,e.reason,DATE_FORMAT(e.occurred_at,'%Y-%m-%dT%H:%i:%s.%fZ') occurredAt,
      (SELECT COUNT(*) FROM document_intelligence_governance_events x WHERE x.entity_type='PASSPORT_PROFILE' AND x.entity_id=p.id AND (x.occurred_at<e.occurred_at OR (x.occurred_at=e.occurred_at AND x.id<=e.id))) entityVersion
      FROM passport_profile_versions p JOIN document_intelligence_governance_events e ON e.entity_type='PASSPORT_PROFILE' AND e.entity_id=p.id ORDER BY e.occurred_at DESC,e.id DESC`);
    return rows.map(row=>{const current=state(text(row,"state"));const profile={...profileJson(row),lifecycle:current};return {profileId:text(row,"profileId")??"",profileCode:text(row,"profileCode")??"",version:integer(row,"version"),state:current,eventId:text(row,"eventId")??"",
      entityVersion:integer(row,"entityVersion"),profile,fromState:text(row,"fromState")===null?null:state(text(row,"fromState")),actorReference:text(row,"actorReference")??"",reason:text(row,"reason")??"",occurredAt:text(row,"occurredAt")??""};});
  }

  async activeProfiles(input:{evaluatedAt:Date;environment:"DEVELOPMENT"|"TEST"|"STAGING"|"PRODUCTION"}):Promise<readonly PassportProfile[]>{
    if(Number.isNaN(input.evaluatedAt.getTime()))throw new Error("PASSPORT_PROFILE_EVALUATED_AT_INVALID");
    const [rows]=await this.#pool.execute<RowDataPacket[]>(`SELECT p.profile_json profileJson FROM passport_profile_versions p JOIN document_intelligence_governance_events e ON e.id=(SELECT x.id
      FROM document_intelligence_governance_events x WHERE x.entity_type='PASSPORT_PROFILE' AND x.entity_id=p.id ORDER BY x.occurred_at DESC,x.id DESC LIMIT 1)
      WHERE e.to_status='ACTIVE' AND (p.staging_test_only=false OR ?=true) AND p.effective_from<=? AND (p.effective_to IS NULL OR p.effective_to>?) ORDER BY p.profile_code,p.version`,
    [input.environment!=="PRODUCTION",input.evaluatedAt,input.evaluatedAt]);
    return rows.map(row=>({...profileJson(row),lifecycle:"ACTIVE"}));
  }

  async #event(connection:PoolConnection,id:string,entityType:"PASSPORT_PROFILE",entityId:string,from:PassportProfileState|null,to:PassportProfileState,actor:string,reason:string,payloadSha256:string,occurredAt:Date){await connection.execute(`INSERT INTO document_intelligence_governance_events
    (id,entity_type,entity_id,from_status,to_status,actor_reference,reason,payload_sha256,occurred_at) VALUES (?,?,?,?,?,?,?,?,?)`,[id,entityType,entityId,from,to,actor,reason,payloadSha256,occurredAt]);}
  async #replay(connection:PoolConnection,id:string,expectedSha:string):Promise<PassportProfileGovernanceResult|null>{const [rows]=await connection.execute<RowDataPacket[]>(`SELECT e.id eventId,e.entity_id profileId,e.to_status state,e.payload_sha256 payloadSha256,p.profile_code profileCode,p.version,
    (SELECT COUNT(*) FROM document_intelligence_governance_events x WHERE x.entity_type='PASSPORT_PROFILE' AND x.entity_id=p.id) entityVersion
    FROM document_intelligence_governance_events e JOIN passport_profile_versions p ON p.id=e.entity_id WHERE e.id=? AND e.entity_type='PASSPORT_PROFILE'`,[id]);if(!rows[0])return null;
    if(text(rows[0],"payloadSha256")!==expectedSha)throw new Error("PASSPORT_PROFILE_IDEMPOTENCY_CONFLICT");return {profileId:text(rows[0],"profileId")??"",profileCode:text(rows[0],"profileCode")??"",version:integer(rows[0],"version"),state:state(text(rows[0],"state")),eventId:id,entityVersion:integer(rows[0],"entityVersion")};}
  async #transaction<T>(work:(connection:PoolConnection)=>Promise<T>):Promise<T>{const connection=await this.#pool.getConnection();try{await connection.beginTransaction();const value=await work(connection);await connection.commit();return value;}catch(error){await connection.rollback();throw error;}finally{connection.release();}}
}
