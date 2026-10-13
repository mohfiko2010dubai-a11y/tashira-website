import { MysqlVisaDeliveryRepository } from './operations/mysql-visa-delivery-repository';
import { defaultOperationsPool } from './operations/mysql-query-client';
import { readVerifiedVisaFile } from './operations/visa-file-evidence';
import { getStorageRoot } from './local-storage';
import type { TransactionalEmailAttachment } from './transactional-email';

export async function visaDeliveryAttachment(reference:string,deliveryId:string):Promise<TransactionalEmailAttachment>{
  const record=await new MysqlVisaDeliveryRepository(defaultOperationsPool()).documentForCustomer(reference,deliveryId);
  if(!record)throw new Error('Visa attachment no longer available for this application');
  const bytes=await readVerifiedVisaFile(getStorageRoot(),record.fileEvidence);
  const extension=record.fileEvidence.mimeType==='application/pdf'?'pdf':record.fileEvidence.mimeType==='image/png'?'png':'jpg';
  return {filename:`visa-${record.delivery.applicantId}.${extension}`,content:bytes.toString('base64')};
}
