import { createClamdVisaScanner } from "./lib/operations/clamd-visa-scanner";
import { captureScannedVisaFile,discardUncommittedVisaFile } from "./lib/operations/visa-file-evidence";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import { assertApplicationReferenceAccess } from "./lib/application-authorization";
import { MysqlOperationsAccessProvider,OperationsAccessError } from "./lib/operations/mysql-access-provider";
import { defaultOperationsPool,defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { MysqlVisaDeliveryRepository } from "./lib/operations/mysql-visa-delivery-repository";
import { getCustomerVisaDeliveryDocument,listCustomerVisaDeliveries,prepareSecureVisaDelivery,type VisaDeliveryRepository } from "./lib/operations/visa-delivery-service";
import { getStorageRoot,visaScannerSocket,SIGNED_URL_EXPIRY,storageCreateSignedUrl } from "./lib/local-storage";
import { applicationAccessQuery,createRouter,staffOrAdminQuery } from "./middleware";

type Access=Pick<MysqlOperationsAccessProvider,"actorForContext"|"flagContextForContext"|"featureFlags">;
type Dependencies={access:Access;repository:VisaDeliveryRepository;now():Date};
async function flags(deps:Dependencies,ctx:TrpcContext,applicationReference:string){const [flagContext,records]=await Promise.all([deps.access.flagContextForContext(ctx),deps.access.featureFlags()]);return {flagContext:{...flagContext,applicationReference},flags:records};}
function safe(error: unknown): never {
  const reason = error instanceof Error ? error.message : '';
  if (error instanceof OperationsAccessError || ['VISA_DELIVERY_DISABLED', 'VISA_DELIVERY_ACCESS_DENIED', 'VISA_DELIVERY_CUSTOMER_AUTHORIZATION_REQUIRED'].includes(reason))
    throw new TRPCError({ code: 'FORBIDDEN', message: 'لا تملك صلاحية فتح هذا الملف أو تغيّر الموظف المسؤول. حدّث الطلب أو راجع المدير.' });
  if (reason === 'VISA_DELIVERY_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: 'ملف التأشيرة غير متاح. حدّث صفحة الطلب أو تواصل مع المسؤول.' });
  if (reason === 'VISA_DELIVERY_IDEMPOTENCY_CONFLICT') throw new TRPCError({ code: 'CONFLICT', message: 'توجد نسخة تسليم محفوظة ببيانات مختلفة. حدّث الطلب وراجع النسخة السابقة.' });
  if (reason === 'VISA_DELIVERY_APPLICATION_STATE_REQUIRED') throw new TRPCError({ code: 'BAD_REQUEST', message: 'يلزم استلام الدفع وتسجيل استلام التأشيرة أولًا. راجع حالة الطلب ثم أعد التجهيز.' });
  if (['VISA_DELIVERY_OWNERSHIP_OR_SCAN_REQUIRED', 'VISA_DELIVERY_SCAN_NOT_PASSED'].includes(reason)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'لم يكتمل فحص ملف التأشيرة الأمني أو الملف لا يخص هذا المسافر. راجع الملف المختار واطلب من الإدارة استكمال الفحص؛ لا يلزم إعادة رفعه إذا كان صحيحًا.' });
  if(reason.startsWith('VISA_FILE_') || reason === 'VISA_DELIVERY_FILE_EVIDENCE_REQUIRED') throw new TRPCError({code:'BAD_REQUEST',message:reason==='VISA_FILE_SCAN_INFECTED' ? 'ملف التأشيرة لم يجتز الفحص الأمني. ارفع نسخة سليمة من المصدر ثم أعد التجهيز.' : 'تعذر التحقق من سلامة ملف التأشيرة الآن. أعد المحاولة، وإذا استمرت المشكلة اطلب من المدير مراجعة خدمة الفحص.'});
  throw new TRPCError({ code: 'BAD_REQUEST', message: 'تعذر حفظ تجهيز التأشيرة. حدّث الطلب ثم أعد المحاولة.' });
}
const reference=z.string().trim().min(3).max(50);
export function createOperationsVisaDeliveryRouter(deps:Dependencies){return createRouter({
  prepare:staffOrAdminQuery.input(z.object({applicationReference:reference,applicantId:z.number().int().positive(),visaDocumentId:z.number().int().positive(),visaReference:z.string().trim().min(2).max(100),validitySummary:z.string().trim().min(3).max(500),customerInstructions:z.array(z.string().trim().min(2).max(500)).min(1).max(20),commandId:z.string().uuid()}).strict()).mutation(async({ctx,input})=>{try{const [actor,gated]=await Promise.all([deps.access.actorForContext(ctx),flags(deps,ctx,input.applicationReference)]);return await prepareSecureVisaDelivery({...gated,actor,repository:deps.repository,...input,now:deps.now()});}catch(error){safe(error);}}),
  customerList:applicationAccessQuery.input(z.object({applicationReference:reference}).strict()).query(async({ctx,input})=>{try{assertApplicationReferenceAccess(ctx,input.applicationReference);const customerAuthorized=ctx.customerApplicationReferences.has(input.applicationReference);return await listCustomerVisaDeliveries({...await flags(deps,ctx,input.applicationReference),repository:deps.repository,applicationReference:input.applicationReference,customerAuthorized});}catch(error){if(error instanceof TRPCError)throw error;safe(error);}}),
  customerDownload:applicationAccessQuery.input(z.object({applicationReference:reference,deliveryId:z.string().uuid()}).strict()).query(async({ctx,input})=>{try{assertApplicationReferenceAccess(ctx,input.applicationReference);const document=await getCustomerVisaDeliveryDocument({...await flags(deps,ctx,input.applicationReference),repository:deps.repository,...input,customerAuthorized:ctx.customerApplicationReferences.has(input.applicationReference)});const {signedUrl}=await storageCreateSignedUrl(document.storagePath);return {delivery:document.delivery,signedUrl,expiresIn:SIGNED_URL_EXPIRY};}catch(error){if(error instanceof TRPCError)throw error;safe(error);}}),
});}
const access=new MysqlOperationsAccessProvider(defaultOperationsSqlClient());
export const operationsVisaDeliveryRouter=createOperationsVisaDeliveryRouter({access,repository:new MysqlVisaDeliveryRepository(defaultOperationsPool(),sourcePath=>captureScannedVisaFile({storageRoot:getStorageRoot(),sourcePath,scan:createClamdVisaScanner(visaScannerSocket(),()=>new Date()),now:()=>new Date()}),evidence=>discardUncommittedVisaFile(getStorageRoot(),evidence)),now:()=>new Date()});
