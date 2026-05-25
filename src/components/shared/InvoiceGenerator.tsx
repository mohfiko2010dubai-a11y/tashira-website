import { jsPDF } from 'jspdf';

interface InvoiceData {
  referenceNumber: string;
  invoiceNumber: string;
  date: string;
  visaType: string;
  processingType: string;
  baseType: string;
  residenceType: string;
  applicantName: string;
  email: string;
  phone: string;
  amount: number;
  applicantsCount: number;
}

export function generateInvoicePDF(data: InvoiceData): void {
  const doc = new jsPDF();
  const primaryColor: [number, number, number] = [201, 160, 76]; // #C9A04C
  
  // Header background
  doc.setFillColor(250, 250, 247);
  doc.rect(0, 0, 210, 50, 'F');
  
  // Logo / Company name
  doc.setFontSize(24);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('TASHIRA', 20, 25);
  
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('E-VISA PORTAL', 20, 32);
  
  // Contact info
  doc.setFontSize(8);
  doc.text('info@tashira.me | +971 4494 6106', 20, 40);
  doc.text('Meydan Grandstand, Dubai, U.A.E.', 20, 45);
  
  // INVOICE title
  doc.setFontSize(28);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 140, 30);
  
  // Invoice details box
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(130, 38, 60, 25, 3, 3, 'S');
  
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice #: ${data.invoiceNumber}`, 135, 46);
  doc.text(`Date: ${data.date}`, 135, 52);
  doc.text(`Ref: ${data.referenceNumber}`, 135, 58);
  
  // Gold line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.8);
  doc.line(20, 55, 190, 55);
  
  // Billed To
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text('Billed To:', 20, 70);
  
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.text(data.applicantName, 20, 77);
  doc.text(data.email, 20, 83);
  doc.text(data.phone, 20, 89);
  
  // Application Details
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text('Application Details:', 120, 70);
  
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.text(`Visa Type: ${data.visaType}`, 120, 77);
  doc.text(`Processing: ${data.processingType}`, 120, 83);
  doc.text(`Type: ${data.baseType} | ${data.residenceType}`, 120, 89);
  doc.text(`Travelers: ${data.applicantsCount}`, 120, 95);
  
  // Table header
  let y = 110;
  doc.setFillColor(...primaryColor);
  doc.setDrawColor(...primaryColor);
  doc.rect(20, y, 170, 10, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', 25, y + 7);
  doc.text('Qty', 120, y + 7);
  doc.text('Amount', 155, y + 7);
  
  // Table content
  y += 15;
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  
  // Row 1: Visa fee
  doc.line(20, y + 5, 190, y + 5);
  doc.text(`${data.visaType} - ${data.processingType} Processing`, 25, y);
  doc.text(String(data.applicantsCount), 125, y);
  doc.text(`$${data.amount.toFixed(2)}`, 155, y);
  
  // Row 2: Service fee
  y += 10;
  doc.line(20, y + 5, 190, y + 5);
  doc.text('Service Fee (Included)', 25, y);
  doc.text('1', 125, y);
  doc.text('$0.00', 155, y);
  
  // Totals
  y += 20;
  doc.setDrawColor(200, 200, 200);
  doc.line(120, y, 190, y);
  
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Subtotal:', 125, y);
  doc.text(`$${data.amount.toFixed(2)}`, 165, y);
  
  y += 8;
  doc.text('Tax:', 125, y);
  doc.text('$0.00', 165, y);
  
  y += 12;
  doc.setFillColor(250, 250, 247);
  doc.rect(120, y - 8, 70, 18, 'F');
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(120, y + 10, 190, y + 10);
  
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 125, y + 5);
  doc.text(`$${data.amount.toFixed(2)}`, 165, y + 5);
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for choosing Tashira E-Visa Portal!', 20, 270);
  doc.text('For inquiries: info@tashira.me | +971 4494 6106', 20, 276);
  doc.text('This is a computer-generated invoice.', 20, 282);
  
  // Save
  doc.save(`Tashira-Invoice-${data.invoiceNumber}.pdf`);
}
