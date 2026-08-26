import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";

const sql=readFileSync("migrations/033_typing_pack_authority_query.sql","utf8");
const rollback=readFileSync("migrations/033_typing_pack_authority_query.rollback.sql","utf8");
describe("Typing Pack and Authority Query migration",()=>{
  it("adds versioned templates, immutable packs and append-only authority evidence",()=>{for(const table of ["operations_typing_pack_templates","operations_typing_packs","operations_authority_queries","operations_authority_query_events"]){expect(sql).toContain(`CREATE TABLE IF NOT EXISTS \`${table}\``);expect(rollback).toContain(`DROP TABLE IF EXISTS \`${table}\``);}for(const trigger of ["typing_pack_template_no_update","typing_pack_no_update","typing_pack_ownership_guard","authority_query_ownership_guard","authority_query_identity_immutable","authority_query_event_no_update"]){expect(sql).toContain(trigger);}expect(sql).toContain("typing_pack_idempotency_uq");expect(sql).toContain("authority_query_event_idempotency_uq");});
  it("does not introduce provider credentials, payment, finance, or document storage",()=>{const statements=sql.replace(/^--.*$/gm,"");expect(statements).not.toMatch(/api_key|credential|secret|supplier_cost|internal_cost|margin|markup|profit|price|payment|stripe|storage_path|document_blob/i);});
});
