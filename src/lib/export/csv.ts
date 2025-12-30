import { createObjectCsvStringifier } from "csv-writer";
import { InvoiceWithLineItems } from "@/types/invoice";
import { formatDate } from "@/lib/utils";

export function generateCSVString(invoices: InvoiceWithLineItems[]): string {
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: "invoiceNumber", title: "Invoice Number" },
      { id: "date", title: "Date" },
      { id: "vendorName", title: "Vendor Name" },
      { id: "vendorEmail", title: "Vendor Email" },
      { id: "fileName", title: "File Name" },
      { id: "description", title: "Description" },
      { id: "totalAmount", title: "Total Amount" },
      { id: "currency", title: "Currency" },
      { id: "status", title: "Status" },
      { id: "createdAt", title: "Created At" },
    ],
  });

  const records = invoices.map((invoice) => ({
    invoiceNumber: invoice.invoiceNumber || "N/A",
    date: invoice.date ? formatDate(invoice.date) : "N/A",
    vendorName: invoice.vendor?.name || "N/A",
    vendorEmail: invoice.vendor?.email || "N/A",
    fileName: invoice.fileName,
    description: invoice.lineItems.map((item) => item.description).join("; "),
    totalAmount: invoice.totalAmount ?? "N/A",
    currency: invoice.currency || "USD",
    status: invoice.status,
    createdAt: formatDate(invoice.createdAt),
  }));

  const csvContent =
    csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

  return csvContent;
}

export function getCSVFilename(): string {
  const timestamp = new Date().toISOString().split("T")[0];
  return `invoices_${timestamp}.csv`;
}
