import { Save, Send } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea } from "@ledgerai/ui";
import { createInvoice } from "../../actions";

export default function NewInvoicePage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Create GST invoice</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Intra-state invoices split CGST/SGST; inter-state and export flows use IGST and export
            flags. Submission and filing remain explicit human-approved actions.
          </p>
        </div>
        <Button form="invoice-form" type="submit">
          <Send className="size-4" />
          Issue invoice
        </Button>
      </div>

      <form id="invoice-form" action={createInvoice} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Invoice details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2 text-sm font-medium">
                Customer name
                <Input name="customerName" defaultValue="Acme Labs Pvt Ltd" required />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Invoice number
                <Input name="invoiceNumber" defaultValue={`NS/26-27/${Date.now().toString().slice(-4)}`} required />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Invoice date
                <Input name="invoiceDate" type="date" defaultValue="2026-05-15" required />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Seller GSTIN
                <Input defaultValue="27AAQCS4259Q1ZP" />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Buyer GSTIN
                <Input name="buyerGstin" defaultValue="29AABCU9603R1ZJ" />
              </label>
              <label className="space-y-2 text-sm font-medium">
                Buyer state
                <Select name="buyerStateCode" defaultValue="29">
                  <option value="27">Maharashtra</option>
                  <option value="29">Karnataka</option>
                  <option value="07">Delhi</option>
                  <option value="33">Tamil Nadu</option>
                  <option value="96">Export / foreign country</option>
                </Select>
              </label>
              <label className="space-y-2 text-sm font-medium">
                Place of supply
                <Select name="placeOfSupply" defaultValue="29">
                  <option value="27">Maharashtra</option>
                  <option value="29">Karnataka</option>
                  <option value="96">Export / foreign country</option>
                </Select>
              </label>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>HSN/SAC</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>GST</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell><Input name="description" defaultValue="AI-assisted monthly design retainer" required /></TableCell>
                  <TableCell><Input name="hsnSac" defaultValue="998314" /></TableCell>
                  <TableCell><Input name="quantity" defaultValue="1" /></TableCell>
                  <TableCell><Input name="unitPrice" defaultValue="80000" /></TableCell>
                  <TableCell><Input name="taxRate" defaultValue="18" /></TableCell>
                  <TableCell className="font-medium text-zinc-950">Rs 94,400</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Button variant="secondary" type="submit">
              <Save className="size-4" />
              Save and issue
            </Button>

            <label className="block space-y-2 text-sm font-medium">
              Terms and notes
              <Textarea name="terms" defaultValue="Payment due within 15 days. This invoice is posted after reviewer approval." />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax calculation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Supply type</span><strong>Inter-state</strong></div>
            <div className="flex justify-between"><span>Taxable value</span><strong>Rs 80,000</strong></div>
            <div className="flex justify-between"><span>IGST 18%</span><strong>Rs 14,400</strong></div>
            <div className="flex justify-between border-t border-zinc-200 pt-3"><span>Total</span><strong>Rs 94,400</strong></div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
              Invoice will enter the GSTR-1 candidate set only after issue approval.
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
