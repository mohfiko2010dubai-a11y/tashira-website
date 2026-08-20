import crypto from "node:crypto";
import { publicAppOrigin } from "./public-app-url";

export const INVOICE_DOWNLOAD_EXPIRY_SECONDS = 60 * 60;

function secret() {
  const value = process.env.STORAGE_URL_SECRET || "";
  if (value.length < 32) throw new Error("STORAGE_URL_SECRET must be at least 32 characters");
  return value;
}

function signature(invoiceNumber: string, referenceNumber: string, expires: number) {
  return crypto.createHmac("sha256", secret())
    .update(`invoice-download\n${invoiceNumber}\n${referenceNumber}\n${expires}`)
    .digest("base64url");
}

export function createInvoiceDownloadUrl(input: {
  baseUrl: string;
  invoiceNumber: string;
  referenceNumber: string;
  nowSeconds?: number;
}) {
  if (!/^[A-Za-z0-9_-]+$/.test(input.invoiceNumber)) throw new Error("Invoice number is invalid");
  const baseUrl = new URL(input.baseUrl);
  if (baseUrl.origin !== publicAppOrigin() || baseUrl.toString() !== `${baseUrl.origin}/`) {
    throw new Error("Invoice download origin is not approved");
  }
  const expires = (input.nowSeconds ?? Math.floor(Date.now() / 1000)) + INVOICE_DOWNLOAD_EXPIRY_SECONDS;
  const url = new URL(`/invoice-download/${encodeURIComponent(input.invoiceNumber)}`, baseUrl.origin);
  url.searchParams.set("expires", String(expires));
  url.searchParams.set("signature", signature(input.invoiceNumber, input.referenceNumber, expires));
  return url.toString();
}

export function verifyInvoiceDownloadToken(input: {
  invoiceNumber: string;
  referenceNumber: string;
  expiresValue: string;
  providedSignature: string;
  nowSeconds?: number;
}) {
  if (!/^[A-Za-z0-9_-]+$/.test(input.invoiceNumber) || !/^\d+$/.test(input.expiresValue)) return false;
  if (!/^[A-Za-z0-9_-]{43}$/.test(input.providedSignature)) return false;
  const expires = Number(input.expiresValue);
  if (expires <= (input.nowSeconds ?? Math.floor(Date.now() / 1000))) return false;
  let expected: string;
  try {
    expected = signature(input.invoiceNumber, input.referenceNumber, expires);
  } catch {
    return false;
  }
  const actualBuffer = Buffer.from(input.providedSignature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}
