// Explicit isolated MySQL rehearsal. Never targets an application database.
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { transformSync } from 'esbuild';
const source = fs.readFileSync(new URL('../api/lib/financial-document-series.ts', import.meta.url), 'utf8');
const code = transformSync(source, { loader: 'ts', format: 'esm' }).code;
const { issueFinancialDocument, prepareFinancialDocument, DocumentNumberChanged, registerLegacyInvoices } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const name='tashira_staging_invoice_rehearsal';
const admin=await mysql.createConnection({socketPath:'/var/run/mysqld/mysqld.sock',user:'root',multipleStatements:true});
const [existing]=await admin.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[name]);
assert.equal(existing.length,0,'Rehearsal database already exists; do not overwrite');
await admin.query('CREATE DATABASE '+name);
const pool=mysql.createPool({socketPath:'/var/run/mysqld/mysqld.sock',user:'root',database:name,connectionLimit:12,multipleStatements:true});
try{
  await pool.query(fs.readFileSync(new URL('../migrations/058_financial_document_series.sql',import.meta.url),'utf8'));
  await pool.query('CREATE TABLE qa_orders (id INT PRIMARY KEY, paid BOOLEAN NOT NULL DEFAULT FALSE) ENGINE=InnoDB');
  for(let i=1;i<=40;i++)await pool.query('INSERT INTO qa_orders (id) VALUES (?)',[i]);
  const input=(id,overrides={})=>({applicationId:id,paymentId:id,issuanceKey:'payment:'+id,kind:'invoice',isTest:false,
    issuedAt:new Date('2026-10-03T12:00:00Z'),snapshot:{synthetic:true},render:number=>Buffer.from('%PDF-1.7\n'+number),...overrides});
  let collisions=0;const lockDurations=[];
  async function paid(id,overrides={},rollback=false){
    for(let attempt=0;attempt<64;attempt++){
      const prepared=await prepareFinancialDocument(pool,input(id,overrides));
      const c=await pool.getConnection();
      try{
        await c.beginTransaction();await c.execute('SELECT id FROM qa_orders WHERE id=? FOR UPDATE',[id]);
        const start=performance.now();const result=await issueFinancialDocument(c,prepared);
        await c.execute('UPDATE qa_orders SET paid=TRUE WHERE id=?',[id]);
        if(rollback)throw Error('injected rollback');
        await c.commit();lockDurations.push(performance.now()-start);return result;
      }catch(error){await c.rollback();if(!(error instanceof DocumentNumberChanged))throw error;collisions++;}
      finally{c.release();}
      await new Promise(resolve=>setTimeout(resolve,5+Math.random()*20));
    }
    throw Error('Synthetic retry budget exhausted');
  }
  await assert.rejects(paid(1,{},true),/injected rollback/);
  const [rolled]=await pool.query('SELECT * FROM financial_document_archives');assert.equal(rolled.length,0);
  const [unpaid]=await pool.query('SELECT paid FROM qa_orders WHERE id=1');assert.equal(unpaid[0].paid,0);
  const legacy=[40,41].map(id=>({applicationId:id,paymentId:100+id,orderReference:'SYNTHETIC-'+id,
    number:'INV-SYNTHETIC-'+id,issuedAt:new Date('2026-08-21T07:00:00Z'),pdf:Buffer.from('%PDF-1.7\noriginal synthetic '+id)}));
  async function mapLegacy(records=legacy,rollback=false){const c=await pool.getConnection();try{await c.beginTransaction();const result=await registerLegacyInvoices(c,records);if(rollback)throw Error('mapping rollback');await c.commit();return result;}catch(error){await c.rollback();throw error;}finally{c.release();}}
  await assert.rejects(mapLegacy(legacy,true),/mapping rollback/);
  const [empty]=await pool.query('SELECT * FROM financial_document_archives');assert.equal(empty.length,0);
  assert.equal((await mapLegacy()).replay,false);
  assert.equal((await mapLegacy()).replay,true);
  await assert.rejects(mapLegacy([...legacy].reverse()),/differs/);
  await assert.rejects(mapLegacy(legacy.map((x,i)=>i?x:{...x,pdf:Buffer.from('%PDF-altered')})),/differs/);
  const [preserved]=await pool.query("SELECT document_number,pdf_bytes FROM financial_document_archives WHERE series='TSH-INV' ORDER BY sequence_number");
  preserved.forEach((row,index)=>{assert.equal(row.document_number,legacy[index].number);assert.deepEqual(row.pdf_bytes,legacy[index].pdf);});
  const first=await paid(1);assert.equal(first.number,'TSH-INV-00003');
  const concurrent=await Promise.all(Array.from({length:20},(_,i)=>paid(i+2)));
  assert.equal(new Set(concurrent.map(x=>x.number)).size,20);
  const [sequence]=await pool.query("SELECT sequence_number FROM financial_document_archives WHERE series='TSH-INV' ORDER BY sequence_number");assert.deepEqual(sequence.map(x=>x.sequence_number),Array.from({length:23},(_,i)=>i+1));
  const replay=await Promise.all([paid(1),paid(1)]);assert(replay.every(x=>x.replay&&x.number===first.number));
  assert.equal((await paid(22,{isTest:true})).number,'TEST-INV-00001');
  assert.equal((await paid(23,{kind:'credit-note',issuanceKey:'refund:test-23'})).number,'TSH-CN-00001');
  assert.equal((await paid(24,{kind:'credit-note',isTest:true,issuanceKey:'refund:test-24'})).number,'TEST-CN-00001');
  assert.equal((await paid(25,{issuedAt:new Date('2027-01-01T00:00:00Z')})).number,'TSH-INV-00024');
  await assert.rejects(paid(26,{render:()=>{throw Error('render failed');}}),/render failed/);
  assert.equal((await paid(27)).number,'TSH-INV-00025');
  assert.equal((await mapLegacy()).replay,true); // Replay must never reset an advanced counter.
  assert.equal((await paid(28)).number,'TSH-INV-00026');
  await assert.rejects(pool.query("UPDATE financial_document_archives SET snapshot_json='{}' WHERE document_number=?",[first.number]),/immutable/);
  await assert.rejects(pool.query('DELETE FROM financial_document_archives WHERE document_number=?',[first.number]),/cannot be deleted/);
  assert(collisions>0,'Concurrent candidates must actually collide and retry');
  console.log(JSON.stringify({database:name,rollbackWithoutGap:true,paymentAndNumberAtomic:true,concurrentPayments:20,duplicateReplay:true,testAndCreditSeriesIndependent:true,noAnnualReset:true,legacyMappingPreserved:true,renderFailureNoGap:true,archiveImmutable:true,collisionsRetried:collisions,maxTransactionMs:Math.max(...lockDurations)}));
}finally{await pool.end();await admin.query('DROP DATABASE '+name);await admin.end();}
