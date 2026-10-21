import type {PoolConnection,RowDataPacket} from 'mysql2/promise';
import {companyLicence} from './company-licence';
import {defaultOperationsPool} from './operations/mysql-query-client';
import {ownershipHost} from '../../contracts/ownership';
export async function recordOrderHost(connection:PoolConnection,applicationId:number,request:Request){
 const settings=await companyLicence();if(!settings)throw new Error('Company settings unavailable');
 const host=ownershipHost(new URL(request.url).hostname,settings.profile);
 await connection.execute('INSERT INTO application_request_hosts(application_id,request_host) VALUES(?,?)',[applicationId,host]);
}
export async function orderOwnership(referenceNumber:string){
 const [rows]=await defaultOperationsPool().execute<RowDataPacket[]>('SELECT h.request_host FROM application_request_hosts h JOIN applications a ON a.id=h.application_id WHERE a.reference_number=?',[referenceNumber]);
 if(!rows[0])return undefined; // Legacy records have no recoverable request host; never invent one.
 const settings=await companyLicence();if(!settings)throw new Error('Company settings unavailable');
 return {host:ownershipHost(String(rows[0].request_host),settings.profile),profile:settings.profile,settingsVersion:settings.version};
}
