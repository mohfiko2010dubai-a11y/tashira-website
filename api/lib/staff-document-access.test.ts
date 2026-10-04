import { describe, expect, it, vi, afterEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { issueStaffDocumentGrant, verifyStaffDocumentGrant, watermarkDocument, STAFF_DOCUMENT_TTL_SECONDS } from './staff-document-access';

afterEach(() => vi.useRealTimers());
describe('document capabilities and watermark copies', () => {
  it('binds a signed capability to one person and rejects expiry/tampering', () => {
    vi.useFakeTimers();
    const url = new URL(issueStaffDocumentGrant(17, 23, 'DOWNLOAD'), 'https://example.invalid');
    const token = url.pathname.split('/').pop()!, signature = url.searchParams.get('signature')!;
    expect(verifyStaffDocumentGrant(token, signature, 23)?.documentId).toBe(17);
    expect(verifyStaffDocumentGrant(token, signature, 24)).toBeNull();
    expect(verifyStaffDocumentGrant(token, signature, undefined)).toBeNull();
    expect(verifyStaffDocumentGrant(token, signature + 'x', 23)).toBeNull();
    vi.advanceTimersByTime(STAFF_DOCUMENT_TTL_SECONDS * 1000);
    expect(verifyStaffDocumentGrant(token, signature, 23)).toBeNull();
  });
  it('preserves the original PDF and all pages while watermarking a copy', async () => {
    const pdf = await PDFDocument.create(); pdf.addPage(); pdf.addPage();
    const original = Buffer.from(await pdf.save()), before = Buffer.from(original);
    const result = await watermarkDocument(original, 'TASHIRA - Staff 23 - TEST');
    expect(original).toEqual(before); expect(Buffer.from(result.bytes)).not.toEqual(before);
    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(2);
    expect(result.mime).toBe('application/pdf');
  });
  it('preserves the original image and returns a readable watermarked JPEG', async () => {
    const original = await sharp({ create: { width: 600, height: 800, channels: 3, background: '#eeeeee' } }).png().toBuffer();
    const before = Buffer.from(original), result = await watermarkDocument(original, 'TASHIRA - Staff 23 - TEST');
    expect(original).toEqual(before); expect(result.mime).toBe('image/jpeg');
    const info = await sharp(result.bytes).metadata(); expect(info.width).toBe(600); expect(info.height).toBe(800);
  });
});
