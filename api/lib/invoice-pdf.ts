import fs from "fs";
import path from "path";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

// Permanent storage - outside dist/ so it survives rebuilds
const STORAGE_DIR = path.resolve(process.cwd(), "storage/invoices");

// Ensure directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  console.log(`[Invoice] Created storage dir: ${STORAGE_DIR}`);
}

export function getStorageDir(): string {
  return STORAGE_DIR;
}

interface InvoiceData {
  invoiceNumber: string;
  referenceNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  passportNumber?: string;
  nationality?: string;
  visaType: string;
  processingType: string;
  arrivalDate?: string;
  totalAmount: number;
  stripePaymentIntentId?: string;
}

// VAT temporarily disabled until TRN is obtained
// const VAT_RATE = 0.05;

export function generateInvoicePDF(data: InvoiceData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const total = data.totalAmount;
  // No VAT breakdown - total is the final amount
  const subtotal = total;

  // === HEADER ===
  doc.setFillColor("#1A2332");
  doc.rect(0, 0, pageWidth, 50, "F");

  doc.setTextColor("#C9A04C");
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("TASHIRA", 15, 25);

  doc.setTextColor("#FFFFFF");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("E-Visa & Tourism L.L.C-FZ", 15, 32);
  doc.text("Meydan Free Zone, Dubai, U.A.E.", 15, 37);
  doc.text("License No: 2541485.01", 15, 42);
  doc.text("Website: tashiraev.com", 15, 47);

  doc.setTextColor("#C9A04C");
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageWidth - 15, 25, { align: "right" });

  doc.setTextColor("#FFFFFF");
  doc.setFontSize(9);
  doc.text(`Invoice #: ${data.invoiceNumber}`, pageWidth - 15, 32, { align: "right" });
  doc.text(`Date: ${new Date(data.createdAt).toLocaleDateString("en-AE")}`, pageWidth - 15, 37, { align: "right" });
  // TRN will be added once obtained from FTA
  // doc.text(`TRN: XXXXXXXXXXXXXXXX`, pageWidth - 15, 42, { align: "right" });

  // === BILL TO ===
  doc.setTextColor("#1A2332");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO:", 15, 65);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#666666");
  const customerNameLines = doc.splitTextToSize(data.customerName, 82) as string[];
  doc.text(customerNameLines, 15, 72);
  const customerEmailY = 72 + (customerNameLines.length * 5);
  const customerPhoneY = customerEmailY + 6;
  doc.text(data.customerEmail, 15, customerEmailY);
  doc.text(data.customerPhone, 15, customerPhoneY);

  // === APPLICATION DETAILS ===
  doc.setTextColor("#1A2332");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("APPLICATION DETAILS:", pageWidth - 15, 65, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#666666");
  doc.text(`Reference: ${data.referenceNumber}`, pageWidth - 15, 72, { align: "right" });
  doc.text(`Visa Type: ${data.visaType}`, pageWidth - 15, 78, { align: "right" });
  doc.text(`Processing: ${data.processingType}`, pageWidth - 15, 84, { align: "right" });
  if (data.arrivalDate) doc.text(`Arrival: ${data.arrivalDate}`, pageWidth - 15, 90, { align: "right" });

  // === LINE ITEMS TABLE ===
  autoTable(doc, {
    startY: Math.max(108, customerPhoneY + 12),
    head: [["Description", "Qty", "Unit Price", "Amount (USD)"]],
    body: [
      [`${data.visaType} - ${data.processingType} Processing`, "1", `$${subtotal.toFixed(2)}`, `$${subtotal.toFixed(2)}`],
      ["", "", "", ""],
      ["", "", "Total:", `$${total.toFixed(2)}`],
    ],
    headStyles: { fillColor: "#1A2332", textColor: "#C9A04C", fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 40, halign: "right" },
      3: { cellWidth: 40, halign: "right" },
    },
    styles: { fontSize: 9, cellPadding: 5 },
    alternateRowStyles: { fillColor: "#FAFAF7" },
  });

  const finalY = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 150;
  // Note: lastAutoTable is added by jspdf-autotable plugin

  // === PAYMENT INFO ===
  doc.setTextColor("#666666");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Payment Status: PAID", 15, finalY + 15);
  doc.text("Payment Method: Credit Card (Stripe)", 15, finalY + 21);
  if (data.stripePaymentIntentId) {
    doc.text(`Transaction ID: ${data.stripePaymentIntentId}`, 15, finalY + 27);
  }

  // === FOOTER ===
  doc.setDrawColor("#C9A04C");
  doc.setLineWidth(0.5);
  doc.line(15, finalY + 40, pageWidth - 15, finalY + 40);
  doc.setTextColor("#666666");
  doc.setFontSize(8);
  doc.text("Thank you for choosing TASHIRA E-Visa & Tourism L.L.C-FZ", pageWidth / 2, finalY + 48, { align: "center" });
  doc.text("This is a computer-generated invoice and does not require a signature.", pageWidth / 2, finalY + 53, { align: "center" });

  return doc;
}

export function saveInvoiceToDisk(data: InvoiceData): { pdfPath: string; pdfUrl: string } {
  const doc = generateInvoicePDF(data);
  const fileName = `${data.invoiceNumber}.pdf`;
  const pdfPath = path.join(STORAGE_DIR, fileName);
  const pdfUrl = `/invoices/${data.invoiceNumber}/view`;

  // Use fs.writeFileSync - Node.js compatible, unlike doc.save()
  const pdfOutput = doc.output("arraybuffer");
  fs.writeFileSync(pdfPath, Buffer.from(pdfOutput));

  console.log(`[Invoice] Saved to: ${pdfPath} (${fs.statSync(pdfPath).size} bytes)`);

  return { pdfPath, pdfUrl };
}
