import {TRPCError} from '@trpc/server';
import type {RowDataPacket} from 'mysql2/promise';
import QRCode from 'qrcode';
import {defaultOperationsPool} from './operations/mysql-query-client';
import {licenceProfileSchema,expiryStatus,type LicenceProfile} from '../../contracts/licence-profile';
export async function companyLicence(){
 const [rows]=await defaultOperationsPool().execute<RowDataPacket[]>('SELECT version,profile_json FROM company_licence_settings ORDER BY version DESC LIMIT 1');
 if(!rows.length)return null;
 const profile=licenceProfileSchema.parse(typeof rows[0].profile_json==='string'?JSON.parse(rows[0].profile_json):rows[0].profile_json);
 return {version:Number(rows[0].version),profile,expiry:expiryStatus(profile.expiresAt),qrDataUrl:await QRCode.toDataURL(profile.verificationUrl,{width:256,margin:4,errorCorrectionLevel:'M'})};
}
export async function saveCompanyLicence(expectedVersion:number,profile:LicenceProfile,actor:string){
 const parsed=licenceProfileSchema.parse(profile);const connection=await defaultOperationsPool().getConnection();
 try{await connection.beginTransaction();const [rows]=await connection.execute<RowDataPacket[]>('SELECT version FROM company_licence_settings ORDER BY version DESC LIMIT 1 FOR UPDATE');
 if(Number(rows[0]?.version??0)!==expectedVersion)throw new TRPCError({code:'CONFLICT',message:'Company licence changed. Refresh before saving.'});
 await connection.execute('INSERT INTO company_licence_settings(version,profile_json,created_by) VALUES(?,?,?)',[expectedVersion+1,JSON.stringify(parsed),actor]);await connection.commit();return {version:expectedVersion+1};
 }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}
