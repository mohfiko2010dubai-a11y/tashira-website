import fs from "fs";
import path from "path";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

const STORAGE_DIR = path.resolve(process.cwd(), "storage/invoices");
const ARABIC_FONT_PATH = path.resolve(process.cwd(), "assets/fonts/NotoNaskhArabic-Regular.ttf");
const ARABIC_FONT_NAME = "NotoNaskhArabic";

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  console.log(`[Invoice] Created storage dir: ${STORAGE_DIR}`);
}

export function getStorageDir(): string {
  return STORAGE_DIR;
}

export interface InvoiceData {
  invoiceNumber: string;
  referenceNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  passportNumber: string;
  passportExpiry: string;
  nationality: string;
  visaType: string;
  processingType: string;
  arrivalDate?: string;
  applicantCount: number;
  unitPriceInBaseCurrency: number;
  baseCurrency: string;
  exchangeRateToBase: number;
  totalAmount: number;
  currency: string;
  stripePaymentIntentId?: string;
}

function registerArabicFont(doc: jsPDF) {
  if (!fs.existsSync(ARABIC_FONT_PATH)) throw new Error("Licensed Arabic invoice font is unavailable");
  doc.addFileToVFS("NotoNaskhArabic-Regular.ttf", fs.readFileSync(ARABIC_FONT_PATH).toString("base64"));
  doc.addFont("NotoNaskhArabic-Regular.ttf", ARABIC_FONT_NAME, "normal");
}

function containsArabic(value: string) {
  return /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

function drawValue(doc: jsPDF, value: string, x: number, y: number, maxWidth: number) {
  const arabic = containsArabic(value);
  const mixedLatin = arabic && /[A-Za-z]/u.test(value);
  if (mixedLatin) {
    const words = value.split(/\s+/u);
    const arabicValue = words.filter(containsArabic).join(" ");
    const latinValue = words.filter((word) => !containsArabic(word)).join(" ");
    doc.setFont(ARABIC_FONT_NAME, "normal");
    doc.setR2L(true);
    doc.text(arabicValue, x + maxWidth, y, { align: "right", maxWidth });
    doc.setR2L(false);
    doc.setFont("helvetica", "normal");
    doc.text(latinValue, x, y + 5.2, { maxWidth });
    return 2;
  }
  doc.setFont(arabic ? ARABIC_FONT_NAME : "helvetica", "normal");
  doc.setR2L(arabic);
  const words = (value || "-").split(/\s+/u);
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (!currentLine || doc.getTextWidth(candidate) <= maxWidth) currentLine = candidate;
    else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  doc.text(lines, arabic ? x + maxWidth : x, y, { align: arabic ? "right" : "left" });
  doc.setR2L(false);
  return lines.length;
}

function drawIdentityRow(doc: jsPDF, label: string, value: string, y: number, maxWidth = 60) {
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#1A2332");
  doc.text(`${label}:`, 15, y);
  doc.setTextColor("#555B66");
  return drawValue(doc, value, 45, y, maxWidth);
}

export function generateInvoicePDF(data: InvoiceData): jsPDF {
  const doc = new jsPDF();
  registerArabicFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const total = data.totalAmount;

  doc.setFillColor("#1A2332");
  doc.rect(0, 0, pageWidth, 52, "F");
  doc.setTextColor("#C9A04C");
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("TASHIRA", 15, 20);
  doc.setFontSize(8);
  doc.text("E-VISA & TOURISM SERVICES", 15, 26);
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "normal");
  doc.text("E-Visa & Tourism L.L.C-FZ", 15, 33);
  doc.text("Meydan Free Zone, Dubai, U.A.E.", 15, 38);
  doc.text("License No: 2541485.01", 15, 43);
  doc.text("Website: tashiraev.com", 15, 48);
  doc.setTextColor("#C9A04C");
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageWidth - 15, 21, { align: "right" });
  doc.setTextColor("#FFFFFF");
  doc.setFontSize(9);
  doc.text(`Invoice #: ${data.invoiceNumber}`, pageWidth - 15, 31, { align: "right" });
  doc.text(`Date: ${formatDate(data.createdAt)}`, pageWidth - 15, 37, { align: "right" });

  doc.setTextColor("#1A2332");
  doc.setFontSize(11);
  doc.text("BILL TO", 15, 64);
  doc.setDrawColor("#C9A04C");
  doc.line(15, 67, 94, 67);
  doc.setFontSize(9);
  let billY = 74;
  for (const [label, value] of [
    ["Customer Name", data.customerName],
    ["Email", data.customerEmail],
    ["Phone", data.customerPhone],
    ["Nationality", data.nationality],
    ["Passport No", data.passportNumber],
    ["Passport Expiry", formatDate(data.passportExpiry)],
  ] as const) {
    const lineCount = drawIdentityRow(doc, label, value, billY);
    billY += Math.max(1, lineCount) * 5.2 + 1.5;
  }

  doc.setTextColor("#1A2332");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("APPLICATION DETAILS", 115, 64);
  doc.line(115, 67, pageWidth - 15, 67);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#555B66");
  const details = [
    `Reference: ${data.referenceNumber}`,
    `Visa Type: ${data.visaType}`,
    `Processing: ${data.processingType}`,
    ...(data.arrivalDate ? [`Arrival Date: ${formatDate(data.arrivalDate)}`] : []),
    `Exchange Rate: 1 ${data.currency} = ${data.exchangeRateToBase.toFixed(4)} ${data.baseCurrency}`,
  ];
  details.forEach((line, index) => doc.text(line, 115, 75 + index * 7));

  const tableStartY = Math.max(118, billY + 5);
  autoTable(doc, {
    startY: tableStartY,
    head: [["DESCRIPTION", "QTY", `UNIT PRICE (${data.baseCurrency})`, `AMOUNT (${data.currency})`]],
    body: [[
      `${data.visaType} - ${data.processingType} Processing`,
      String(data.applicantCount),
      data.unitPriceInBaseCurrency.toFixed(2),
      total.toFixed(2),
    ]],
    headStyles: { fillColor: "#1A2332", textColor: "#C9A04C", fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 42, halign: "right" },
      3: { cellWidth: 42, halign: "right" },
    },
    styles: { fontSize: 9, cellPadding: 5 },
  });

  const finalY = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 150;
  doc.setFillColor("#FAFAF7");
  doc.roundedRect(pageWidth - 88, finalY + 8, 73, 18, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#1A2332");
  doc.setFontSize(10);
  doc.text(`TOTAL AMOUNT (${data.currency})`, pageWidth - 84, finalY + 15);
  doc.setTextColor("#C9A04C");
  doc.setFontSize(15);
  doc.text(`${data.currency === "USD" ? "$" : ""}${total.toFixed(2)}`, pageWidth - 19, finalY + 21, { align: "right" });

  doc.setTextColor("#666666");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Payment Status: PAID", 15, finalY + 15);
  doc.text("Payment Method: Credit Card (Stripe)", 15, finalY + 21);
  if (data.stripePaymentIntentId) doc.text(`Transaction ID: ${data.stripePaymentIntentId}`, 15, finalY + 27);

  const footerY = Math.max(finalY + 44, 260);
  doc.setDrawColor("#C9A04C");
  doc.line(15, footerY, pageWidth - 15, footerY);
  doc.setTextColor("#1A2332");
  doc.setFontSize(9);
  doc.text("Thank you for choosing Tashira.", pageWidth / 2, footerY + 8, { align: "center" });
  doc.setTextColor("#666666");
  doc.text("We wish you a pleasant stay in the UAE.", pageWidth / 2, footerY + 14, { align: "center" });
  return doc;
}

export function saveInvoiceToDisk(data: InvoiceData): { pdfPath: string; pdfUrl: string } {
  const doc = generateInvoicePDF(data);
  const fileName = `${data.invoiceNumber}.pdf`;
  const pdfPath = path.join(STORAGE_DIR, fileName);
  const pdfUrl = `/invoices/${data.invoiceNumber}/view`;
  fs.writeFileSync(pdfPath, Buffer.from(doc.output("arraybuffer")));
  console.log(`[Invoice] Saved to: ${pdfPath} (${fs.statSync(pdfPath).size} bytes)`);
  return { pdfPath, pdfUrl };
}
