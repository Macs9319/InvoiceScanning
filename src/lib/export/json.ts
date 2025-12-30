import { InvoiceWithLineItems } from "@/types/invoice";

export function generateJSONString(invoices: InvoiceWithLineItems[]): string {
  const data = invoices.map((invoice) => ({
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.date,
    vendor: invoice.vendor ? {
      id: invoice.vendor.id,
      name: invoice.vendor.name,
      email: invoice.vendor.email,
    } : null,
    fileName: invoice.fileName,
    totalAmount: invoice.totalAmount,
    currency: invoice.currency,
    status: invoice.status,
    lineItems: invoice.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
    })),
    createdAt: invoice.createdAt,
  }));

  return JSON.stringify(data, null, 2);
}

export function getJSONFilename(): string {
  const timestamp = new Date().toISOString().split("T")[0];
  return `invoices_${timestamp}.json`;
}
