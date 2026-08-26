import type { AuthorizationActor } from "../authorization/policy";
import { isOperationsFlagEnabled,type FeatureFlagContext,type FeatureFlagRecord } from "../feature-flags/feature-flags";
import type { ProposeRegulatoryChangeCommand,RegulatoryChangeRecord,ReviewRegulatoryChangeCommand } from "./mysql-regulatory-change-repository";

export type RegulatoryChangeRepository={list():Promise<readonly RegulatoryChangeRecord[]>;get(changeId:string):Promise<RegulatoryChangeRecord|null>;propose(input:ProposeRegulatoryChangeCommand):Promise<RegulatoryChangeRecord>;review(input:ReviewRegulatoryChangeCommand):Promise<RegulatoryChangeRecord>};
type Context={actor:AuthorizationActor;flagContext:FeatureFlagContext;flags:readonly FeatureFlagRecord[];repository:RegulatoryChangeRepository};
function enabled(input:Context):void{if(!isOperationsFlagEnabled("REGULATORY_WATCHER",input.flagContext,input.flags))throw new Error("REGULATORY_WATCHER_DISABLED");}
function permission(input:Context,required:"rule.read"|"rule.propose"|"rule.review"):void{if(!input.actor.permissions.has(required))throw new Error("REGULATORY_CHANGE_ACCESS_DENIED");}
export async function listRegulatoryChanges(input:Context):Promise<readonly RegulatoryChangeRecord[]>{enabled(input);permission(input,"rule.read");return input.repository.list();}
export async function proposeRegulatoryChangeRecord(input:Context&Omit<ProposeRegulatoryChangeCommand,"actorReference"|"occurredAt">&{now:Date}):Promise<RegulatoryChangeRecord>{enabled(input);permission(input,"rule.propose");return input.repository.propose({...input,actorReference:input.actor.id,occurredAt:input.now.toISOString()});}
export async function reviewRegulatoryChangeRecord(input:Context&Omit<ReviewRegulatoryChangeCommand,"actorReference"|"occurredAt">&{now:Date}):Promise<RegulatoryChangeRecord>{enabled(input);permission(input,"rule.review");return input.repository.review({...input,actorReference:input.actor.id,occurredAt:input.now.toISOString()});}
