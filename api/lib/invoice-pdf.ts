import fs from "fs";
import path from "path";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

const INVOICES_DIR = path.resolve(process.cwd(), "dist/public/invoices");

// Ensure directory exists
if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
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

const VAT_RATE = 0.05;

export function generateInvoicePDF(data: InvoiceData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const total = data.totalAmount;
  const subtotal = total / (1 + VAT_RATE);
  const vatAmount = total - subtotal;

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
  doc.text("TAX INVOICE", pageWidth - 15, 25, { align: "right" });

  doc.setTextColor("#FFFFFF");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice #: ${data.invoiceNumber}`, pageWidth - 15, 32, { align: "right" });
  doc.text(`Date: ${new Date(data.createdAt).toLocaleDateString("en-AE")}`, pageWidth - 15, 37, { align: "right" });
  doc.text(`TRN: TO-BE-ADDED`, pageWidth - 15, 42, { align: "right" });

  // === BILL TO ===
  doc.setTextColor("#1A2332");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO:", 15, 65);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#666666");
  doc.text(data.customerName, 15, 72);
  doc.text(data.customerEmail, 15, 78);
  doc.text(data.customerPhone, 15, 84);
  if (data.passportNumber) doc.text(`Passport: ${data.passportNumber}`, 15, 90);
  if (data.nationality) doc.text(`Nationality: ${data.nationality}`, 15, 96);

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
  (doc as any).autoTable({
    startY: 108,
    head: [["Description", "Qty", "Unit Price", "Amount (USD)"]],
    body: [
      [`${data.visaType} - ${data.processingType} Processing`, "1", `$${subtotal.toFixed(2)}`, `$${subtotal.toFixed(2)}`],
      ["", "", "", ""],
      ["", "", "Subtotal (excl. VAT):", `$${subtotal.toFixed(2)}`],
      ["", "", "VAT 5%:", `$${vatAmount.toFixed(2)}`],
      ["", "", "Total (incl. VAT):", `$${total.toFixed(2)}`],
    ],
    headStyles: { fillColor: "#1A2332", textColor: "#C9A04C", fontStyle: "bold" },
    footStyles: { fillColor: "#F5F5F0", textColor: "#1A2332", fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 40, halign: "right" },
      3: { cellWidth: 40, halign: "right" },
    },
    styles: { fontSize: 9, cellPadding: 5 },
    alternateRowStyles: { fillColor: "#FAFAF7" },
    didParseCell: (hookData: any) => {
      if (hookData.row.index === 4 && hookData.section === "body") {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.textColor = "#C9A04C";
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 150;

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
  const pdfPath = path.join(INVOICES_DIR, fileName);
  const pdfUrl = `/invoices/${fileName}`;

  doc.save(pdfPath);
  return { pdfPath, pdfUrl };
}
