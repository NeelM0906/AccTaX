import { notFound } from "next/navigation";
import { formatInr } from "@ledgerai/config";
import { getInvoicePrintData } from "@/lib/server/workspace";

type InvoicePrintPageProps = {
  params: Promise<{ invoiceId: string }>;
};

export default async function InvoicePrintPage({ params }: InvoicePrintPageProps) {
  const { invoiceId } = await params;
  const data = await getInvoicePrintData(invoiceId);
  if (!data) notFound();
  const { business, invoice, items, party } = data;
  const gstTotal = Number(invoice.cgst) + Number(invoice.sgst) + Number(invoice.igst);

  return (
    <div className="min-h-screen bg-white p-8 text-zinc-950 print:p-0">
      <style>{`
        @media print {
          body { background: white; }
          aside, header { display: none !important; }
          main { display: block !important; }
        }
      `}</style>
      <div className="mx-auto max-w-4xl border border-zinc-200 p-8 print:border-0">
        <div className="flex items-start justify-between border-b border-zinc-300 pb-6">
          <div>
            <div className="text-2xl font-semibold">Tax Invoice</div>
            <div className="mt-2 text-sm text-zinc-600">{business?.legalName ?? business?.name}</div>
            <div className="text-sm text-zinc-600">GSTIN: {invoice.sellerGstin}</div>
            <div className="text-sm text-zinc-600">State code: {invoice.sellerStateCode}</div>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold">{invoice.invoiceNumber}</div>
            <div>Date: {invoice.invoiceDate.toLocaleDateString("en-IN")}</div>
            <div>Status: {invoice.status}</div>
          </div>
        </div>

        <div className="grid gap-6 border-b border-zinc-200 py-6 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase text-zinc-500">Bill to</div>
            <div className="mt-2 font-medium">{party?.displayName ?? "Customer"}</div>
            <div className="text-sm text-zinc-600">GSTIN: {invoice.buyerGstin ?? "Unregistered"}</div>
            <div className="text-sm text-zinc-600">Place of supply: {invoice.placeOfSupply}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-zinc-500">Tax summary</div>
            <div className="mt-2 text-sm">Taxable value: {formatInr(Number(invoice.taxableValue))}</div>
            <div className="text-sm">GST: {formatInr(gstTotal)}</div>
            <div className="text-sm font-semibold">Invoice value: {formatInr(Number(invoice.total))}</div>
          </div>
        </div>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-left">
              <th className="py-2">Description</th>
              <th className="py-2">HSN/SAC</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Rate</th>
              <th className="py-2 text-right">GST</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-zinc-100">
                <td className="py-3">{item.description}</td>
                <td className="py-3">{item.hsnSac ?? "-"}</td>
                <td className="py-3 text-right">{item.quantity.toString()}</td>
                <td className="py-3 text-right">{formatInr(Number(item.unitPrice))}</td>
                <td className="py-3 text-right">{formatInr(Number(item.cgst) + Number(item.sgst) + Number(item.igst))}</td>
                <td className="py-3 text-right">{formatInr(Number(item.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 flex justify-end">
          <div className="w-80 space-y-2 text-sm">
            <div className="flex justify-between"><span>Taxable value</span><strong>{formatInr(Number(invoice.taxableValue))}</strong></div>
            <div className="flex justify-between"><span>CGST</span><strong>{formatInr(Number(invoice.cgst))}</strong></div>
            <div className="flex justify-between"><span>SGST</span><strong>{formatInr(Number(invoice.sgst))}</strong></div>
            <div className="flex justify-between"><span>IGST</span><strong>{formatInr(Number(invoice.igst))}</strong></div>
            <div className="flex justify-between border-t border-zinc-300 pt-2 text-base"><span>Total</span><strong>{formatInr(Number(invoice.total))}</strong></div>
          </div>
        </div>
        <div className="mt-10 text-xs text-zinc-500">
          Generated from LedgerAI India approved records. Review before sharing or filing.
        </div>
      </div>
    </div>
  );
}
