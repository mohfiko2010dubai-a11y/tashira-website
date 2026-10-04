import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { documents } from '@db/schema';
import { getDb } from '../queries/connection';
import type { TrpcContext } from '../context';
import { enforceStaffApplicationScope } from './staff-application-scope';
import { resolveStoragePath } from './local-storage';
import { defaultOperationsPool } from './operations/mysql-query-client';

export const STAFF_DOCUMENT_TTL_SECONDS = 120;
type Grant = { documentId: number; staffId: number; action: 'VIEW' | 'DOWNLOAD'; expires: number };
const grants = new Map<string, Grant>();
const signingKey = randomBytes(32);
const sign = (token: string) => createHmac('sha256', signingKey).update(token).digest('base64url');
export function issueStaffDocumentGrant(documentId: number, staffId: number, action: Grant['action']): string {
  for (const [token, grant] of grants) if (grant.expires <= Date.now()) grants.delete(token);
  const token = randomBytes(32).toString('hex');
  grants.set(token, { documentId, staffId, action, expires: Date.now() + STAFF_DOCUMENT_TTL_SECONDS * 1000 });
  return `/staff-document/${token}?signature=${sign(token)}`;
}
export function verifyStaffDocumentGrant(token: string, signature: string, staffId: number | undefined): Grant | null {
  const expected = Buffer.from(sign(token)), provided = Buffer.from(signature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  const grant = grants.get(token);
  if (!grant || grant.expires <= Date.now() || grant.staffId !== staffId) return null;
  return grant;
}
export async function watermarkDocument(bytes: Buffer, label: string): Promise<{ bytes: Uint8Array; mime: string }> {
  if (bytes.subarray(0, 5).toString() === '%PDF-') {
    const pdf = await PDFDocument.load(bytes);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (const page of pdf.getPages()) {
      const { width, height } = page.getSize();
      page.drawText(label, { x: 12, y: 12, size: Math.min(9, (width - 24) / Math.max(1, font.widthOfTextAtSize(label, 1))), font, color: rgb(.25,.25,.25) });
      page.drawText(label, { x: width * .12, y: height * .25, size: Math.min(17, width / 35), font, rotate: degrees(35), opacity: .16 });
    }
    return { bytes: await pdf.save(), mime: 'application/pdf' };
  }
  const source = sharp(bytes).rotate();
  const normalized = await source.toBuffer({ resolveWithObject: true });
  const width = normalized.info.width, height = normalized.info.height;
  const font = Math.max(10, Math.round(width / 65));
  // Label is server-generated ASCII (numeric staff ID and UTC date), never user markup.
  const overlay = Buffer.from(`<svg width="${width}" height="${height}"><rect y="${height-font*3}" width="${width}" height="${font*3}" fill="white" opacity="0.85"/><text x="8" y="${height-font}" font-size="${font}" fill="#222">${label}</text><text x="${width*.1}" y="${height*.5}" font-size="${font*2}" fill="#222" opacity="0.16">${label}</text></svg>`);
  return { bytes: await sharp(normalized.data).composite([{ input: overlay }]).jpeg({ quality: 92 }).toBuffer(), mime: 'image/jpeg' };
}
export async function readStaffDocument(ctx: TrpcContext, token: string, signature: string) {
  const grant = verifyStaffDocumentGrant(token, signature, ctx.staffId);
  if (!grant || !ctx.staffId) return null;
  await enforceStaffApplicationScope(ctx, 'storage.getSignedUrl', { documentId: grant.documentId }, false);
  const [document] = await getDb().select().from(documents).where(eq(documents.id, grant.documentId)).limit(1);
  if (!document || document.uploadStatus === 'replaced') return null;
  const result = await watermarkDocument(await readFile(resolveStoragePath(document.storagePath)), `TASHIRA - Staff ${ctx.staffId} - ${new Date().toISOString()}`);
  // Fail closed if the audit write fails. The original file is never modified.
  await defaultOperationsPool().execute('INSERT INTO document_access_events(document_id,staff_id,action) VALUES(?,?,?)', [grant.documentId, ctx.staffId, grant.action]);
  return { ...result, action: grant.action };
}
