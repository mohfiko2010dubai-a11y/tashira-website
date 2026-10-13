import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({document:vi.fn(),read:vi.fn()}));
vi.mock('./operations/mysql-visa-delivery-repository',()=>({MysqlVisaDeliveryRepository:class {documentForCustomer=mocks.document;}}));
vi.mock('./operations/mysql-query-client',()=>({defaultOperationsPool:()=>({})}));
vi.mock('./operations/visa-file-evidence',()=>({readVerifiedVisaFile:mocks.read}));
vi.mock('./local-storage',()=>({getStorageRoot:()=>'/test-root'}));
import {visaDeliveryAttachment} from './visa-delivery-email';
beforeEach(()=>{vi.resetAllMocks();});
describe('visa email attachment',()=>{
 it('attaches the verified snapshot bytes for the same application',async()=>{const evidence={mimeType:'application/pdf'};mocks.document.mockResolvedValue({delivery:{applicantId:42},fileEvidence:evidence});mocks.read.mockResolvedValue(Buffer.from('verified file'));expect(await visaDeliveryAttachment('TSH-1','delivery-1')).toEqual({filename:'visa-42.pdf',content:Buffer.from('verified file').toString('base64')});expect(mocks.document).toHaveBeenCalledWith('TSH-1','delivery-1');expect(mocks.read).toHaveBeenCalledWith('/test-root',evidence);});
 it('does not read another application or revoked file',async()=>{mocks.document.mockResolvedValue(null);await expect(visaDeliveryAttachment('OTHER','delivery-1')).rejects.toThrow();expect(mocks.read).not.toHaveBeenCalled();});
 it('rejects changed snapshot bytes',async()=>{mocks.document.mockResolvedValue({delivery:{applicantId:42},fileEvidence:{mimeType:'application/pdf'}});mocks.read.mockRejectedValue(new Error('integrity mismatch'));await expect(visaDeliveryAttachment('TSH-1','delivery-1')).rejects.toThrow('integrity mismatch');});
});
