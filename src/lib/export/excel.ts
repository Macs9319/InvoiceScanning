import * as XLSX from "xlsx";
import { InvoiceWithLineItems } from "@/types/invoice";
import { formatDate } from "@/lib/utils";

export function generateExcelBuffer(invoices: InvoiceWithLineItems[]): Buffer {
  // Create a new workbook
  const wb = XLSX.utils.book_new();

  // Prepare summary data
  const summaryData = invoices.map((invoice) => ({
    "Invoice Number": invoice.invoiceNumber || "N/A",
    Date: invoice.date ? formatDate(invoice.date) : "N/A",
    "Vendor Name": invoice.vendor?.name || "N/A",
    "Vendor Email": invoice.vendor?.email || "N/A",
    "File Name": invoice.fileName,
    Description: invoice.lineItems.map((item) => item.description).join("; "),
    "Total Amount": invoice.totalAmount ?? "N/A",
    Currency: invoice.currency || "USD",
    Status: invoice.status,
    "Created At": formatDate(invoice.createdAt),
  }));

  // Create summary worksheet
  const summaryWs = XLSX.utils.json_to_sheet(summaryData);

  // Set column widths
  summaryWs["!cols"] = [
    { wch: 20 }, // Invoice Number
    { wch: 15 }, // Date
    { wch: 25 }, // Vendor Name
    { wch: 30 }, // Vendor Email
    { wch: 30 }, // File Name
    { wch: 50 }, // Description
    { wch: 15 }, // Total Amount
    { wch: 10 }, // Currency
    { wch: 12 }, // Status
    { wch: 20 }, // Created At
  ];

  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  // Create detailed line items worksheet
  const lineItemsData: any[] = [];

  invoices.forEach((invoice) => {
    invoice.lineItems.forEach((item) => {
      lineItemsData.push({
        "Invoice Number": invoice.invoiceNumber || "N/A",
        "Invoice Date": invoice.date ? formatDate(invoice.date) : "N/A",
        "Vendor Name": invoice.vendor?.name || "N/A",
        "Vendor Email": invoice.vendor?.email || "N/A",
        Description: item.description,
        Quantity: item.quantity ?? "N/A",
        "Unit Price": item.unitPrice ?? "N/A",
        Amount: item.amount ?? "N/A",
        Currency: invoice.currency || "USD",
      });
    });
  });

  if (lineItemsData.length > 0) {
    const detailsWs = XLSX.utils.json_to_sheet(lineItemsData);
    detailsWs["!cols"] = [
      { wch: 20 }, // Invoice Number
      { wch: 15 }, // Invoice Date
      { wch: 25 }, // Vendor Name
      { wch: 30 }, // Vendor Email
      { wch: 50 }, // Description
      { wch: 12 }, // Quantity
      { wch: 15 }, // Unit Price
      { wch: 15 }, // Amount
      { wch: 10 }, // Currency
    ];
    XLSX.utils.book_append_sheet(wb, detailsWs, "Line Items");
  }

  // Write to buffer
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return buffer;
}

export function getExcelFilename(): string {
  const timestamp = new Date().toISOString().split("T")[0];
  return `invoices_${timestamp}.xlsx`;
}
