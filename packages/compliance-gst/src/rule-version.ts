export const GST_RULE_VERSION = {
  id: "in-gst-2026-05-15",
  jurisdiction: "IN",
  taxSystem: "GST",
  packageName: "@ledgerai/compliance-gst",
  effectiveFrom: "2026-05-15",
  lastVerified: "2026-05-15",
  currency: "INR",
  moneyPrecision: 2,
  thresholds: {
    qrmpAggregateTurnover: 50_000_000,
    iffMonthlyTaxableValue: 5_000_000,
    eInvoiceAggregateTurnover: 50_000_000,
    eWayBillConsignmentValue: 50_000,
    b2cLargeInterStateInvoiceValue: 250_000
  },
  references: [
    {
      id: "cgst-rule-46-invoice-number",
      title: "CGST Rules, Rule 46 invoice particulars"
    },
    {
      id: "gst-portal-qrmp-faq",
      title: "GST portal QRMP FAQ"
    },
    {
      id: "gst-council-10-2023-central-tax",
      title: "Notification 10/2023-Central Tax for e-invoicing"
    },
    {
      id: "cgst-rule-138-ewaybill",
      title: "CGST Rules, Rule 138 e-way bill"
    }
  ]
} as const;

export type GstRuleVersion = typeof GST_RULE_VERSION;

