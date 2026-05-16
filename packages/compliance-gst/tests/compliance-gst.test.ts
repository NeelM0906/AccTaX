import { describe, expect, it } from "vitest";
import {
  aggregateTaxBreakups,
  buildGstr1Draft,
  buildGstr3bSummary,
  calculateGstTax,
  canUseIff,
  classifySupply,
  isEInvoiceApplicable,
  isEWayBillRequired,
  isQrmpEligible,
  validateGstin,
  validateInvoiceNumber,
  type GstInvoiceInput,
} from "../src";

const VALID_MH_GSTIN = "27AAPFU0939F1ZV";

describe("GSTIN validation", () => {
  it("accepts a GSTIN with a valid checksum", () => {
    const result = validateGstin(VALID_MH_GSTIN);

    expect(result.valid).toBe(true);
    expect(result.value).toBe(VALID_MH_GSTIN);
  });

  it("rejects bad GSTIN checksum and format", () => {
    expect(validateGstin("27AAPFU0939F1ZW").issues.map((issue) => issue.code)).toContain(
      "GSTIN_CHECKSUM",
    );
    expect(validateGstin("27AAPFU0939F1").issues.map((issue) => issue.code)).toContain(
      "GSTIN_LENGTH",
    );
  });
});

describe("invoice number validation", () => {
  it("accepts alphanumeric invoice numbers with slash and hyphen", () => {
    expect(validateInvoiceNumber("INV/24-25/001").valid).toBe(true);
  });

  it("rejects invalid characters, excessive length, and duplicates", () => {
    expect(validateInvoiceNumber("INV 001").issues.map((issue) => issue.code)).toContain(
      "INVOICE_NUMBER_CHARACTERS",
    );
    expect(validateInvoiceNumber("INV-2026-000000001").issues.map((issue) => issue.code)).toContain(
      "INVOICE_NUMBER_LENGTH",
    );
    expect(
      validateInvoiceNumber("INV/001", { existingInvoiceNumbers: ["inv/001"] }).issues.map(
        (issue) => issue.code,
      ),
    ).toContain("INVOICE_NUMBER_DUPLICATE");
  });
});

describe("tax calculation", () => {
  it("splits intra-state GST into CGST and SGST", () => {
    const tax = calculateGstTax({
      taxableValue: 1000,
      gstRate: 18,
      supplierStateCode: "27",
      placeOfSupplyStateCode: "27",
    });

    expect(tax.placeOfSupplyKind).toBe("intrastate");
    expect(tax.cgst).toBe(90);
    expect(tax.sgst).toBe(90);
    expect(tax.igst).toBe(0);
    expect(tax.invoiceValue).toBe(1180);
  });

  it("charges IGST for inter-state supplies", () => {
    const tax = calculateGstTax({
      taxableValue: 1000,
      gstRate: 18,
      supplierStateCode: "27",
      placeOfSupplyStateCode: "29",
    });

    expect(tax.placeOfSupplyKind).toBe("interstate");
    expect(tax.igst).toBe(180);
    expect(tax.cgst).toBe(0);
    expect(tax.sgst).toBe(0);
  });

  it("aggregates invoice tax totals including rounded GST and cess", () => {
    const taxLines = [
      calculateGstTax({
        taxableValue: 1000,
        gstRate: 18,
        supplierStateCode: "27",
        placeOfSupplyStateCode: "27",
        cessAmount: 5,
      }),
      calculateGstTax({
        taxableValue: 500,
        gstRate: 12,
        supplierStateCode: "27",
        placeOfSupplyStateCode: "29",
        cessAmount: 2.5,
      }),
      calculateGstTax({
        taxableValue: 250,
        gstRate: 0,
        supplierStateCode: "27",
        placeOfSupplyStateCode: "27",
      }),
    ];

    expect(taxLines[0]).toMatchObject({
      taxableValue: 1000,
      cgst: 90,
      sgst: 90,
      cess: 5,
      totalTax: 185,
    });
    expect(taxLines[1]).toMatchObject({ taxableValue: 500, igst: 60, cess: 2.5, totalTax: 62.5 });
    expect(aggregateTaxBreakups(taxLines)).toEqual({
      taxableValue: 1750,
      igst: 60,
      cgst: 90,
      sgst: 90,
      cess: 7.5,
      totalTax: 247.5,
      invoiceValue: 1997.5,
    });
  });

  it("handles export tax treatment with and without payment of IGST", () => {
    expect(
      calculateGstTax({
        taxableValue: 1000,
        gstRate: 18,
        supplierStateCode: "27",
        placeOfSupplyStateCode: "97",
        isExport: true,
        exportType: "with_payment",
      }),
    ).toMatchObject({
      placeOfSupplyKind: "interstate",
      igst: 180,
      totalTax: 180,
      invoiceValue: 1180,
    });

    expect(
      calculateGstTax({
        taxableValue: 1000,
        gstRate: 18,
        supplierStateCode: "27",
        placeOfSupplyStateCode: "97",
        isExport: true,
        exportType: "without_payment",
      }),
    ).toMatchObject({ placeOfSupplyKind: "interstate", igst: 0, totalTax: 0, invoiceValue: 1000 });
  });
});

describe("supply classification", () => {
  it("classifies exports, nil-rated, exempt, and non-GST supplies deterministically", () => {
    expect(classifySupply({ isExport: true })).toBe("export");
    expect(classifySupply({ taxability: "nil_rated", isExport: true })).toBe("nil");
    expect(classifySupply({ taxability: "exempt" })).toBe("exempt");
    expect(classifySupply({ taxability: "non_gst" })).toBe("non_gst");
    expect(classifySupply({ recipientGstin: VALID_MH_GSTIN })).toBe("b2b");
    expect(classifySupply({})).toBe("b2c");
  });
});

describe("QRMP and IFF helpers", () => {
  it("flags QRMP eligibility from turnover and filing status", () => {
    expect(
      isQrmpEligible({
        currentYearAggregateTurnover: 50_000_000,
        precedingYearAggregateTurnover: 49_000_000,
        hasFiledLastGstr3b: true,
      }).eligible,
    ).toBe(true);

    expect(
      isQrmpEligible({
        currentYearAggregateTurnover: 50_000_001,
        hasFiledLastGstr3b: true,
      }).reasons,
    ).toContain("CURRENT_YEAR_TURNOVER_EXCEEDS_LIMIT");
  });

  it("allows IFF only for QRMP registered-recipient supplies in first two months of a quarter", () => {
    expect(
      canUseIff({
        isQrmpOpted: true,
        returnPeriod: "2026-04",
        supplyClassification: "b2b",
        documentTaxableValue: 1000,
      }).eligible,
    ).toBe(true);

    expect(
      canUseIff({
        isQrmpOpted: true,
        returnPeriod: "2026-06",
        supplyClassification: "b2b",
        documentTaxableValue: 1000,
      }).reasons,
    ).toContain("IFF_NOT_AVAILABLE_FOR_M3");

    expect(
      canUseIff({
        isQrmpOpted: true,
        returnPeriod: "2026-04",
        supplyClassification: "b2c",
        documentTaxableValue: 1000,
      }).reasons,
    ).toContain("IFF_ONLY_FOR_REGISTERED_RECIPIENT_SUPPLIES");

    expect(
      canUseIff({
        isQrmpOpted: true,
        returnPeriod: "2026-04",
        supplyClassification: "b2b",
        documentTaxableValue: 1,
        currentMonthIffTaxableValue: 5_000_000,
      }).reasons,
    ).toContain("IFF_MONTHLY_VALUE_EXCEEDS_LIMIT");
  });
});

describe("threshold helpers", () => {
  it("applies e-invoice threshold only above Rs. 5 crore for supported outward supplies", () => {
    expect(
      isEInvoiceApplicable({
        aggregateTurnover: 50_000_001,
        supplyClassification: "b2b",
        documentDate: "2026-04-01",
      }).applicable,
    ).toBe(true);

    expect(
      isEInvoiceApplicable({
        aggregateTurnover: 50_000_000,
        supplyClassification: "b2b",
        documentDate: "2026-04-01",
      }).reasons,
    ).toContain("TURNOVER_NOT_ABOVE_THRESHOLD");

    expect(
      isEInvoiceApplicable({
        aggregateTurnover: 60_000_000,
        supplyClassification: "b2c",
        documentDate: "2026-04-01",
      }).reasons,
    ).toContain("SUPPLY_CLASSIFICATION_NOT_SUPPORTED");
  });

  it("requires e-way bill only for goods movement above Rs. 50,000 by default", () => {
    expect(isEWayBillRequired({ consignmentValue: 50_001, supplyKind: "goods" }).applicable).toBe(
      true,
    );
    expect(isEWayBillRequired({ consignmentValue: 50_000, supplyKind: "goods" }).reasons).toContain(
      "CONSIGNMENT_VALUE_NOT_ABOVE_THRESHOLD",
    );
    expect(
      isEWayBillRequired({ consignmentValue: 100_000, supplyKind: "services" }).reasons,
    ).toContain("EWAYBILL_ONLY_FOR_GOODS_MOVEMENT");
  });
});

describe("GSTR-1 draft builder", () => {
  it("aggregates B2B, B2C small, export, and nil-rated supplies", () => {
    const draft = buildGstr1Draft(sampleInvoices());

    expect(draft.issues).toEqual([]);
    expect(draft.b2b).toHaveLength(1);
    expect(draft.b2b[0]?.recipientGstin).toBe(VALID_MH_GSTIN);
    expect(draft.b2b[0]?.lines[0]).toMatchObject({
      rate: 18,
      taxableValue: 1000,
      cgst: 90,
      sgst: 90,
    });

    expect(draft.b2cs).toHaveLength(1);
    expect(draft.b2cs[0]).toMatchObject({
      placeOfSupplyStateCode: "29",
      rate: 18,
      taxableValue: 1000,
      igst: 180,
    });

    expect(draft.exports).toHaveLength(1);
    expect(draft.exports[0]?.lines[0]).toMatchObject({ taxableValue: 2000, igst: 0 });

    expect(draft.nil).toMatchObject({ nilRated: 300, exempt: 400, nonGst: 500, total: 1200 });
  });

  it("groups repeated invoice line rates and preserves invoice totals", () => {
    const draft = buildGstr1Draft([
      {
        invoiceNumber: "B2B/MULTI/001",
        invoiceDate: "2026-04-10",
        supplierStateCode: "27",
        recipientGstin: VALID_MH_GSTIN,
        placeOfSupplyStateCode: "27",
        lines: [
          { taxableValue: 600, gstRate: 18 },
          { taxableValue: 400, gstRate: 18 },
          { taxableValue: 200, gstRate: 5, cessAmount: 3 },
        ],
      },
    ]);

    expect(draft.issues).toEqual([]);
    expect(draft.b2b).toHaveLength(1);
    expect(draft.b2b[0]).toMatchObject({
      invoiceNumber: "B2B/MULTI/001",
      invoiceValue: 1393,
      supplyType: "intrastate",
      reverseCharge: false,
    });
    expect(draft.b2b[0]?.lines).toEqual([
      { rate: 5, taxableValue: 200, igst: 0, cgst: 5, sgst: 5, cess: 3 },
      { rate: 18, taxableValue: 1000, igst: 0, cgst: 90, sgst: 90, cess: 0 },
    ]);
  });
});

describe("GSTR-3B summary builder", () => {
  it("aggregates outward taxable, zero-rated, nil/exempt/non-GST, and inter-state unregistered supplies", () => {
    const summary = buildGstr3bSummary(sampleInvoices());

    expect(summary.outwardTaxableSupplies).toMatchObject({
      taxableValue: 2000,
      igst: 180,
      cgst: 90,
      sgst: 90,
    });
    expect(summary.outwardZeroRatedSupplies).toMatchObject({ taxableValue: 2000, igst: 0 });
    expect(summary.outwardNilExemptNonGstSupplies).toMatchObject({ taxableValue: 1200, igst: 0 });
    expect(summary.interStateUnregisteredSupplies).toEqual([
      {
        placeOfSupplyStateCode: "29",
        taxableValue: 1000,
        igst: 180,
        cgst: 0,
        sgst: 0,
        cess: 0,
      },
    ]);
  });

  it("matches GSTR-1 outward taxable buckets to GSTR-3B outward taxable totals", () => {
    const invoices: GstInvoiceInput[] = [
      {
        invoiceNumber: "B2B/TOT/001",
        invoiceDate: "2026-04-05",
        supplierStateCode: "27",
        recipientGstin: VALID_MH_GSTIN,
        placeOfSupplyStateCode: "27",
        lines: [
          { taxableValue: 1000, gstRate: 18 },
          { taxableValue: 500, gstRate: 12, cessAmount: 5 },
        ],
      },
      {
        invoiceNumber: "B2C/TOT/001",
        invoiceDate: "2026-04-06",
        supplierStateCode: "27",
        placeOfSupplyStateCode: "29",
        lines: [{ taxableValue: 2000, gstRate: 18, cessAmount: 10 }],
      },
      {
        invoiceNumber: "B2CL/TOT/001",
        invoiceDate: "2026-04-07",
        supplierStateCode: "27",
        placeOfSupplyStateCode: "33",
        lines: [{ taxableValue: 300_000, gstRate: 18 }],
      },
    ];
    const draft = buildGstr1Draft(invoices);
    const summary = buildGstr3bSummary(invoices);

    expect(draft.issues).toEqual([]);
    expect(draft.b2b).toHaveLength(1);
    expect(draft.b2cs).toHaveLength(1);
    expect(draft.b2cl).toHaveLength(1);
    expect(
      sumTaxSummaries([
        ...draft.b2b.flatMap((invoice) => invoice.lines),
        ...draft.b2cl.flatMap((invoice) => invoice.lines),
        ...draft.b2cs,
      ]),
    ).toEqual(summary.outwardTaxableSupplies);
  });

  it("keeps export-with-payment IGST in the zero-rated GSTR-3B bucket", () => {
    const summary = buildGstr3bSummary([
      {
        invoiceNumber: "EXP/PAY/001",
        invoiceDate: "2026-04-07",
        supplierStateCode: "27",
        placeOfSupplyStateCode: "97",
        isExport: true,
        exportType: "with_payment",
        lines: [{ taxableValue: 2000, gstRate: 18 }],
      },
    ]);

    expect(summary.outwardZeroRatedSupplies).toEqual({
      taxableValue: 2000,
      igst: 360,
      cgst: 0,
      sgst: 0,
      cess: 0,
    });
    expect(summary.outwardTaxableSupplies).toEqual({
      taxableValue: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
      cess: 0,
    });
  });
});

function sumTaxSummaries(
  summaries: readonly {
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  }[],
): { taxableValue: number; igst: number; cgst: number; sgst: number; cess: number } {
  return summaries.reduce(
    (total, summary) => ({
      taxableValue: total.taxableValue + summary.taxableValue,
      igst: total.igst + summary.igst,
      cgst: total.cgst + summary.cgst,
      sgst: total.sgst + summary.sgst,
      cess: total.cess + summary.cess,
    }),
    { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
  );
}

function sampleInvoices(): GstInvoiceInput[] {
  return [
    {
      invoiceNumber: "B2B/001",
      invoiceDate: "2026-04-05",
      supplierStateCode: "27",
      recipientGstin: VALID_MH_GSTIN,
      placeOfSupplyStateCode: "27",
      lines: [{ taxableValue: 1000, gstRate: 18 }],
    },
    {
      invoiceNumber: "B2C/001",
      invoiceDate: "2026-04-06",
      supplierStateCode: "27",
      placeOfSupplyStateCode: "29",
      lines: [{ taxableValue: 1000, gstRate: 18 }],
    },
    {
      invoiceNumber: "EXP/001",
      invoiceDate: "2026-04-07",
      supplierStateCode: "27",
      placeOfSupplyStateCode: "97",
      isExport: true,
      exportType: "without_payment",
      lines: [{ taxableValue: 2000, gstRate: 18 }],
    },
    {
      invoiceNumber: "NIL/001",
      invoiceDate: "2026-04-08",
      supplierStateCode: "27",
      placeOfSupplyStateCode: "27",
      lines: [
        { taxableValue: 300, gstRate: 0, taxability: "nil_rated" },
        { taxableValue: 400, gstRate: 0, taxability: "exempt" },
        { taxableValue: 500, gstRate: 0, taxability: "non_gst" },
      ],
    },
  ];
}
