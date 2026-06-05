import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  totalAmountUsd: number; // USD from Stripe - PRIMARY
  exchangeRate?: number;  // Rate to convert to AED
  stripePaymentIntentId?: string;
}

const VAT_RATE = 0.05;
const DEFAULT_EXCHANGE_RATE = 3.6725;

export function generateInvoicePDF(data: InvoiceData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // USD is primary, calculate AED
  const exchangeRate = data.exchangeRate || DEFAULT_EXCHANGE_RATE;
  const totalUsd = data.totalAmountUsd;
  const totalAed = totalUsd * exchangeRate;
  const subtotalAed = totalAed / (1 + VAT_RATE);
  const vatAmountAed = totalAed - subtotalAed;

  const goldColor = '#C9A04C';
  const darkColor = '#1A2332';
  const grayColor = '#666666';

  // === HEADER ===
  doc.setFillColor(darkColor);
  doc.rect(0, 0, pageWidth, 50, 'F');

  doc.setTextColor(goldColor);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('TASHIRA', 15, 25);

  doc.setTextColor('#FFFFFF');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('E-Visa & Tourism L.L.C-FZ', 15, 32);
  doc.text('Meydan Free Zone, Dubai, U.A.E.', 15, 37);
  doc.text('License No: 2541485.01', 15, 42);
  doc.text('Website: tashiraev.com', 15, 47);

  doc.setTextColor(goldColor);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', pageWidth - 15, 25, { align: 'right' });

  doc.setTextColor('#FFFFFF');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice #: ${data.invoiceNumber}`, pageWidth - 15, 32, { align: 'right' });
  doc.text(`Date: ${new Date(data.createdAt).toLocaleDateString('en-AE')}`, pageWidth - 15, 37, { align: 'right' });
  doc.text(`TRN: TO-BE-ADDED`, pageWidth - 15, 42, { align: 'right' });

  // === BILL TO ===
  doc.setTextColor(darkColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', 15, 65);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayColor);
  doc.text(data.customerName, 15, 72);
  doc.text(data.customerEmail, 15, 78);
  doc.text(data.customerPhone, 15, 84);
  if (data.passportNumber) doc.text(`Passport: ${data.passportNumber}`, 15, 90);
  if (data.nationality) doc.text(`Nationality: ${data.nationality}`, 15, 96);

  // === APPLICATION DETAILS ===
  doc.setTextColor(darkColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('APPLICATION DETAILS:', pageWidth - 15, 65, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(grayColor);
  doc.text(`Reference: ${data.referenceNumber}`, pageWidth - 15, 72, { align: 'right' });
  doc.text(`Visa Type: ${data.visaType}`, pageWidth - 15, 78, { align: 'right' });
  doc.text(`Processing: ${data.processingType}`, pageWidth - 15, 84, { align: 'right' });
  if (data.arrivalDate) doc.text(`Arrival: ${data.arrivalDate}`, pageWidth - 15, 90, { align: 'right' });
  doc.text(`Exchange Rate: ${exchangeRate} AED/USD`, pageWidth - 15, 96, { align: 'right' });

  // === TOTAL AMOUNT (USD) - ON TOP ===
  doc.setFillColor('#FFF8E7');
  doc.roundedRect(15, 105, pageWidth - 30, 20, 3, 3, 'F');
  doc.setTextColor(darkColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('TOTAL AMOUNT (USD):', 20, 118);
  doc.setTextColor(goldColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`$${totalUsd.toFixed(2)}`, pageWidth - 20, 118, { align: 'right' });

  // === LINE ITEMS TABLE (AED DETAILS) ===
  autoTable(doc, {
    startY: 135,
    head: [['Description', 'Qty', 'Unit Price (AED)', 'Amount (AED)']],
    body: [
      [`${data.visaType} - ${data.processingType} Processing`, '1', `AED ${subtotalAed.toFixed(2)}`, `AED ${subtotalAed.toFixed(2)}`],
      ['', '', '', ''],
      ['', '', 'Subtotal (excl. VAT):', `AED ${subtotalAed.toFixed(2)}`],
      ['', '', 'VAT 5%:', `AED ${vatAmountAed.toFixed(2)}`],
      ['', '', 'Total (incl. VAT):', `AED ${totalAed.toFixed(2)}`],
    ],
    headStyles: {
      fillColor: darkColor,
      textColor: goldColor,
      fontStyle: 'bold',
    },
    footStyles: {
      fillColor: '#F5F5F0',
      textColor: darkColor,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 50, halign: 'right' },
      3: { cellWidth: 50, halign: 'right' },
    },
    styles: {
      fontSize: 9,
      cellPadding: 5,
    },
    alternateRowStyles: {
      fillColor: '#FAFAF7',
    },
    didParseCell: (data) => {
      if (data.row.index === 4 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = goldColor;
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 150;

  // === TOTAL AMOUNT (USD) - AT BOTTOM ===
  doc.setFillColor(darkColor);
  doc.roundedRect(15, finalY + 10, pageWidth - 30, 18, 3, 3, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Equivalent in USD (Rate: ${exchangeRate}):`, 20, finalY + 22);
  doc.setTextColor(goldColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`$${totalUsd.toFixed(2)}`, pageWidth - 20, finalY + 22, { align: 'right' });

  // === PAYMENT INFO ===
  doc.setTextColor(grayColor);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Payment Status: PAID`, 15, finalY + 42);
  doc.text(`Payment Method: Credit Card (Stripe)`, 15, finalY + 48);
  if (data.stripePaymentIntentId) {
    doc.text(`Transaction ID: ${data.stripePaymentIntentId}`, 15, finalY + 54);
  }

  // === FOOTER ===
  doc.setDrawColor(goldColor);
  doc.setLineWidth(0.5);
  doc.line(15, finalY + 65, pageWidth - 15, finalY + 65);

  doc.setTextColor(grayColor);
  doc.setFontSize(8);
  doc.text('Thank you for choosing TASHIRA E-Visa & Tourism L.L.C-FZ', pageWidth / 2, finalY + 73, { align: 'center' });
  doc.text('This is a computer-generated invoice and does not require a signature.', pageWidth / 2, finalY + 78, { align: 'center' });

  return doc;
}

export function saveInvoicePDF(data: InvoiceData): { pdfBlob: Blob; pdfPath: string; pdfUrl: string } {
  const doc = generateInvoicePDF(data);
  const pdfBlob = doc.output('blob');
  const pdfPath = `/invoices/${data.invoiceNumber}.pdf`;
  const pdfUrl = URL.createObjectURL(pdfBlob);
  return { pdfBlob, pdfPath, pdfUrl };
}
