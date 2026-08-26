import { describe,expect,it } from "vitest";
import type { TrpcContext } from "./context";
import type { AuthorizationActor } from "./lib/authorization/policy";
import type { FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import type { SupplierSlaRepository } from "./lib/operations/supplier-sla-service";
import { createOperationsSupplierSlaRouter } from "./operations-supplier-sla-router";
const ctx=(staffId?:number):TrpcContext=>({req:new Request("https://staging.invalid"),resHeaders:new Headers(),isAdmin:false,staffId,customerApplicationReferences:new Set()});
const flag:FeatureFlagRecord={flagKey:"SUPPLIER_SLA",environment:"STAGING",enabled:true,scopeType:"TEAM",scopeReference:"7"};
const actor:AuthorizationActor={id:"staff:4",permissions:new Set(["supplier.read_operational","case.transition"]),scopes:["TEAM"],teamIds:new Set([7]),departmentIds:new Set()};
const item={slaId:"11111111-1111-4111-8111-111111111111",applicationId:1,applicationReference:"TSH-1",supplierId:9,supplierName:"Supplier",routeCode:"UAE_30",state:"COMPLETION_WARNING" as const,escalationLevel:0,version:1,startedAt:"2026-08-26T10:00:00Z",acknowledgementDueAt:"2026-08-26T11:00:00Z",completionDueAt:"2026-08-26T14:00:00Z",teamId:7,departmentId:2};
function setup(flags:readonly FeatureFlagRecord[]=[flag]){const commands:unknown[]=[];const repository:SupplierSlaRepository={list:async()=>[item],get:async()=>item,apply:async(_id,command)=>{commands.push(command);return {...item,version:2}},startContext:async()=>({applicationId:1,applicationReference:"TSH-1",teamId:7,departmentId:2}),start:async(command)=>{commands.push(command);return item}};const access={actorForContext:async()=>actor,flagContextForContext:async()=>({environment:"STAGING" as const,staffId:4,teamIds:new Set([7])}),featureFlags:async()=>flags};return {commands,router:createOperationsSupplierSlaRouter({access,repository,now:()=>new Date("2026-08-26T13:30:00Z")})};}
describe("Operations Supplier SLA router",()=>{
  it("requires staff and a scoped enabled flag",async()=>{await expect(setup().router.createCaller(ctx()).list({})).rejects.toMatchObject({code:"FORBIDDEN"});await expect(setup([]).router.createCaller(ctx(4)).list({})).rejects.toMatchObject({code:"FORBIDDEN"});});
  it("derives START and command actors server-side",async()=>{const value=setup();await value.router.createCaller(ctx(4)).start({applicationReference:"TSH-1",commandId:"start-001",reason:"Supplier handoff"});await value.router.createCaller(ctx(4)).command({slaId:item.slaId,command:{commandId:"escalate-001",expectedVersion:1,action:"ESCALATE",reason:"Deadline warning"}});expect(value.commands).toEqual([expect.objectContaining({actorStaffId:4,occurredAt:"2026-08-26T13:30:00.000Z"}),expect.objectContaining({actorStaffId:4,occurredAt:"2026-08-26T13:30:00.000Z"})]);});
  it("rejects client-provided actor fields",async()=>{await expect(setup().router.createCaller(ctx(4)).start({applicationReference:"TSH-1",commandId:"start-001",reason:"Supplier handoff",actorStaffId:999} as never)).rejects.toMatchObject({code:"BAD_REQUEST"});});
});
