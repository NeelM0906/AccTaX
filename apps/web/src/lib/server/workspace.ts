import "server-only";

import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, prisma } from "@ledgerai/db";
import {
  buildGstr1Draft,
  buildGstr3bSummary,
  calculateGstTax,
  validateGstin,
  type GstInvoiceInput
} from "@ledgerai/compliance-gst";
import {
  compareRegimes,
  evaluateSection44ADAEligibility,
  estimateSection44ADAPresumptiveIncome
} from "@ledgerai/compliance-income-tax";
import {
  calculateBusinessMileageDeduction,
  calculateUsSalesTax,
  evaluate1099KThreshold,
  evaluateUsEconomicNexus,
  buildUsEstimatedTaxPlan,
  listLaunchSalesTaxJurisdictions,
  US_TY_2026_RULE_METADATA,
  CA_2026_RULE_METADATA,
  type UsStateCode,
  type UsLaunchJurisdictionCode
} from "@ledgerai/compliance-na";
import { createBillPosting, createInvoicePosting, defaultIndiaSmallBusinessChart, suggestCategory } from "@ledgerai/accounting";
import {
  LocalPrivateStorageAdapter,
  classifyDocumentStub
} from "@ledgerai/documents";
import type { DocumentClassificationResult } from "@ledgerai/documents";
import {
  OpenAiExtractionProvider,
  bankStatementExtractionSchema,
  invoiceBillReceiptExtractionSchema,
  renderExtractionPrompt,
  safeJsonParse,
  validateExtraction
} from "@ledgerai/ai-extraction";
import type { InvoiceBillReceiptExtraction, BankStatementExtraction } from "@ledgerai/ai-extraction";
import { getServerEnv, isOpenAiModelAllowed } from "@ledgerai/config";

const DEMO_USER_EMAIL = "owner@ledgerai.local";
const DEMO_WORKSPACE_SLUG = "niyati-studio";
const DEMO_ACTOR_ID = "dev-user";
const PROJECT_ENTITY_TYPE = "project";
const execFile = promisify(execFileCallback);

const globalForWorkspaceSeed = globalThis as typeof globalThis & {
  ledgerAiWorkspaceSeed?: Promise<WorkspaceContext>;
};

type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  businessId: string;
  gstRegistrationId: string;
  workspaceName: string;
  gstin: string;
  stateCode: string;
  financialYear: string;
};

type FieldValue = string | number | boolean | null;

type ExtractionBuildResult = {
  fields: Record<string, FieldValue>;
  source: "openai" | "heuristic";
  confidence: number;
  validation: unknown;
  aiRunId?: string;
  rawOutput?: unknown;
};

type ExportableRecord = Record<string, string | number | boolean | null | undefined>;

type DocumentContentResult = {
  textSample: string;
  pages: Array<{
    pageNumber: number;
    text: string;
    confidence?: number;
  }>;
  provider: "native_text" | "pdftotext" | "openai_vision" | "tesseract_local" | "filename_fallback";
  model?: string;
  warnings: string[];
  rawOutput?: unknown;
};

type OpenAiAvailability = {
  available: boolean;
  reason?: string;
};

type OcrImageInput = {
  pageNumber: number;
  mimeType: string;
  base64: string;
};

type AssistantAnswerInput = {
  region: "india" | "north-america";
  query: string;
  project?: {
    id: string;
    name: string;
  } | null;
  money: {
    income: number;
    expenses: number;
    receivables: number;
  };
  documents: Array<{
    id: string;
    originalFilename: string;
    status: string;
    type: string;
  }>;
  transactions: Array<{
    id: string;
    description: string;
    amount: Prisma.Decimal;
    category: string | null;
    transactionDate: Date;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    total: Prisma.Decimal;
  }>;
  bills: Array<{
    id: string;
    billNumber: string;
    status: string;
    total: Prisma.Decimal;
  }>;
  suggestions: Array<{
    id: string;
    title: string;
  }>;
  reviewTasks: Array<{
    id: string;
    title: string;
  }>;
};

type OpenAiResponsesPayload = {
  id?: string;
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
};

type VisionOcrResponse = {
  pages?: Array<{
    pageNumber?: number;
    text?: string;
    confidence?: number;
  }>;
  summary?: string;
};

type ProjectTask = {
  id: string;
  title: string;
  description: string | null;
  entityId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectSummary = {
  id: string;
  name: string;
  detail: string;
  isDefault: boolean;
  fileCount: number;
  reviewCount: number;
  updatedAt: Date;
  createdAt: Date;
};

export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  globalForWorkspaceSeed.ledgerAiWorkspaceSeed ??= ensureWorkspaceSeeded().catch((error) => {
    globalForWorkspaceSeed.ledgerAiWorkspaceSeed = undefined;
    throw error;
  });

  return globalForWorkspaceSeed.ledgerAiWorkspaceSeed;
}

export async function ensureWorkspaceSeeded(): Promise<WorkspaceContext> {
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: {
      id: DEMO_ACTOR_ID,
      email: DEMO_USER_EMAIL,
      name: "First Client Owner"
    }
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: DEMO_WORKSPACE_SLUG },
    update: {},
    create: {
      name: "Niyati Studio",
      slug: DEMO_WORKSPACE_SLUG,
      currentFinancialYear: "FY2026-27",
      createdById: user.id
    }
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: { status: "ACTIVE", role: "OWNER" },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "OWNER",
      status: "ACTIVE",
      createdById: user.id
    }
  });

  let business = await prisma.business.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" }
  });

  business ??= await prisma.business.create({
    data: {
      workspaceId: workspace.id,
      name: "Niyati Studio",
      legalName: "Niyati Studio",
      legalType: "PROPRIETORSHIP",
      pan: "AAQCS4259Q",
      primaryStateCode: "27",
      businessType: "PROFESSIONAL",
      turnoverEstimate: 2_400_000,
      preferredInvoiceFormat: "gst_invoice",
      onboardingComplete: true,
      createdById: user.id
    }
  });

  const gstRegistration = await prisma.gstRegistration.upsert({
    where: { workspaceId_gstin: { workspaceId: workspace.id, gstin: "27AAQCS4259Q1ZP" } },
    update: {},
    create: {
      workspaceId: workspace.id,
      businessId: business.id,
      gstin: "27AAQCS4259Q1ZP",
      stateCode: "27",
      legalName: "Niyati Studio",
      filingFrequency: "MONTHLY",
      createdById: user.id
    }
  });

  await prisma.taxProfile.upsert({
    where: { id: `${business.id}-tax-profile` },
    update: {},
    create: {
      id: `${business.id}-tax-profile`,
      workspaceId: workspace.id,
      businessId: business.id,
      kind: "PROFESSIONAL",
      assessmentYear: "AY2026-27",
      presumptiveSection: "44ADA",
      cashReceiptsPercent: 2,
      createdById: user.id
    }
  });

  for (const account of defaultIndiaSmallBusinessChart) {
    await prisma.ledgerAccount.upsert({
      where: { workspaceId_code: { workspaceId: workspace.id, code: account.code } },
      update: {},
      create: {
        workspaceId: workspace.id,
        code: account.code,
        name: account.name,
        type: account.type,
        systemCategory: account.systemCategory,
        createdById: user.id
      }
    });
  }

  await seedSampleRecordsIfEmpty({
    userId: user.id,
    workspaceId: workspace.id,
    businessId: business.id
  });

  return {
    userId: user.id,
    workspaceId: workspace.id,
    businessId: business.id,
    gstRegistrationId: gstRegistration.id,
    workspaceName: workspace.name,
    gstin: gstRegistration.gstin,
    stateCode: gstRegistration.stateCode,
    financialYear: workspace.currentFinancialYear
  };
}

export async function getShellData() {
  const ctx = await getWorkspaceContext();
  const suggestions = await prisma.aiSuggestion.findMany({
    where: { workspaceId: ctx.workspaceId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 3
  });

  return { ctx, suggestions };
}

export async function getDashboardData() {
  const ctx = await getWorkspaceContext();
  const [documentsNeedingReview, aiPending, invoices, bills, transactions] = await Promise.all([
    prisma.document.count({ where: { workspaceId: ctx.workspaceId, status: "NEEDS_REVIEW" } }),
    prisma.aiSuggestion.count({ where: { workspaceId: ctx.workspaceId, status: "PENDING" } }),
    prisma.invoice.findMany({ where: { workspaceId: ctx.workspaceId } }),
    prisma.bill.findMany({ where: { workspaceId: ctx.workspaceId } }),
    prisma.transaction.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { transactionDate: "desc" }, take: 8 })
  ]);

  const sales = sum(invoices.map((invoice) => invoice.total));
  const expenses = sum(bills.map((bill) => bill.total));
  const itc = sum(bills.filter((bill) => bill.itcEligible).map((bill) => Number(bill.cgst) + Number(bill.sgst) + Number(bill.igst)));
  const receivables = sum(invoices.filter((invoice) => invoice.status !== "PAID" && invoice.status !== "CANCELLED").map((invoice) => invoice.total));
  const gst = await getGstData();
  const validationCount = gst.validations.length;

  return {
    ctx,
    cards: [
      {
        label: "Compliance health",
        value: validationCount === 0 ? "Ready" : `${Math.max(50, 100 - validationCount * 12)}%`,
        detail: validationCount === 0 ? "No blocking GST validations for current records" : `${validationCount} GST validation items need review`,
        status: validationCount === 0 ? "Ready" : "In review"
      },
      {
        label: "Documents needing review",
        value: String(documentsNeedingReview),
        detail: "Uploaded documents stay out of GST until approval",
        status: documentsNeedingReview > 0 ? "Needs review" : "Clear"
      },
      {
        label: "GST period status",
        value: validationCount === 0 ? "Ready to export" : "Draft",
        detail: "GSTR-1 and GSTR-3B are computed from approved records",
        status: "April"
      },
      {
        label: "AI actions awaiting approval",
        value: String(aiPending),
        detail: "Suggestions require human approval before mutation",
        status: aiPending > 0 ? "Approval" : "Clear"
      }
    ],
    money: { sales, expenses, itc, receivables },
    transactions
  };
}

export async function getDocumentsData() {
  const ctx = await getWorkspaceContext();
  const documents = await prisma.document.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" }
  });

  const extractionCounts = await prisma.documentExtraction.groupBy({
    by: ["documentId"],
    where: { workspaceId: ctx.workspaceId },
    _count: true
  });
  const counts = new Map(extractionCounts.map((item) => [item.documentId, item._count]));

  return { ctx, documents: documents.map((document) => ({ ...document, extractionCount: counts.get(document.id) ?? 0 })) };
}

export async function getProjectsData(region: "india" | "north-america") {
  const ctx = await getWorkspaceContext();
  await ensureDefaultProject(ctx, region);

  const projectTasks = await prisma.reviewTask.findMany({
    where: { workspaceId: ctx.workspaceId, entityType: PROJECT_ENTITY_TYPE, status: { not: "CLOSED" } },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });

  const projects = await Promise.all(projectTasks.map((project) => summarizeProject(ctx, region, project)));

  return {
    ctx,
    region,
    basePath: regionBasePath(region),
    projects,
    totals: {
      projects: projects.length,
      files: projects.reduce((total, project) => total + project.fileCount, 0),
      reviews: projects.reduce((total, project) => total + project.reviewCount, 0)
    }
  };
}

export async function getProjectForAssistant(region: "india" | "north-america", projectId: string) {
  const ctx = await getWorkspaceContext();
  await ensureDefaultProject(ctx, region);
  const project = await findActiveProject(ctx, projectId);
  return project ? summarizeProject(ctx, region, project) : null;
}

export async function getProjectWorkspaceData(region: "india" | "north-america", projectId: string) {
  const ctx = await getWorkspaceContext();
  await ensureDefaultProject(ctx, region);
  const projectTask = await findActiveProject(ctx, projectId);
  if (!projectTask) return null;

  const documentWhere = projectDocumentWhere(ctx, projectTask);
  const documents = await prisma.document.findMany({
    where: documentWhere,
    orderBy: { createdAt: "desc" },
    take: 30
  });
  const documentIds = documents.map((document) => document.id);
  const scopedDocumentIds = documentIds.length > 0 ? documentIds : ["__no_project_documents__"];
  const isDefault = isDefaultProject(ctx, projectTask);

  const [transactions, invoices, bills, reviewTasks, exportJobs] = await Promise.all([
    prisma.transaction.findMany({
      where: isDefault
        ? { workspaceId: ctx.workspaceId }
        : { workspaceId: ctx.workspaceId, sourceDocumentId: { in: scopedDocumentIds } },
      orderBy: { transactionDate: "desc" },
      take: 12
    }),
    prisma.invoice.findMany({
      where: isDefault
        ? { workspaceId: ctx.workspaceId }
        : { workspaceId: ctx.workspaceId, documentId: { in: scopedDocumentIds } },
      orderBy: { invoiceDate: "desc" },
      take: 12
    }),
    prisma.bill.findMany({
      where: isDefault
        ? { workspaceId: ctx.workspaceId }
        : { workspaceId: ctx.workspaceId, documentId: { in: scopedDocumentIds } },
      orderBy: { billDate: "desc" },
      take: 12
    }),
    prisma.reviewTask.findMany({
      where: isDefault
        ? {
            workspaceId: ctx.workspaceId,
            status: { in: ["OPEN", "IN_PROGRESS"] },
            entityType: { not: PROJECT_ENTITY_TYPE }
          }
        : {
            workspaceId: ctx.workspaceId,
            status: { in: ["OPEN", "IN_PROGRESS"] },
            entityType: { not: PROJECT_ENTITY_TYPE },
            entityId: { in: scopedDocumentIds }
          },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 8
    }),
    prisma.exportJob.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      take: isDefault ? 6 : 0
    })
  ]);

  const money = {
    income: sum(invoices.map((invoice) => invoice.total)),
    expenses: sum(bills.map((bill) => bill.total)),
    receivables: sum(invoices.filter((invoice) => invoice.status !== "PAID" && invoice.status !== "CANCELLED").map((invoice) => invoice.total))
  };
  const project = await summarizeProject(ctx, region, projectTask);
  const docsNeedingReview = documents.filter((document) => document.status === "NEEDS_REVIEW" || document.status === "EXTRACTED");

  return {
    ctx,
    region,
    basePath: regionBasePath(region),
    project,
    documents,
    docsNeedingReview,
    transactions,
    invoices,
    bills,
    reviewTasks,
    exportJobs,
    money,
    overview: buildProjectOverview({
      project,
      documents,
      docsNeedingReview,
      transactions,
      invoices,
      bills,
      reviewTasks
    })
  };
}

export async function getDocumentReviewData(documentId: string) {
  const ctx = await getWorkspaceContext();
  const document = await prisma.document.findFirst({
    where: { id: documentId, workspaceId: ctx.workspaceId }
  });
  if (!document) return null;

  const extraction = await prisma.documentExtraction.findFirst({
    where: { workspaceId: ctx.workspaceId, documentId: document.id },
    orderBy: { createdAt: "desc" }
  });
  const fields = extraction
    ? await prisma.documentExtractionField.findMany({
        where: { workspaceId: ctx.workspaceId, extractionId: extraction.id },
        orderBy: { fieldPath: "asc" }
      })
    : [];

  return { ctx, document, extraction, fields };
}

export async function getDocumentFileData(documentId: string) {
  const ctx = await getWorkspaceContext();
  const document = await prisma.document.findFirst({
    where: { id: documentId, workspaceId: ctx.workspaceId }
  });
  if (!document) return null;

  const stored = await getLocalStorage().getObject({ key: document.storageKey });
  return {
    document,
    bytes: stored.body,
    contentType: stored.contentType || document.mimeType || "application/octet-stream"
  };
}

export async function getInvoicesData() {
  const ctx = await getWorkspaceContext();
  const invoices = await prisma.invoice.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ invoiceDate: "desc" }, { invoiceNumber: "desc" }]
  });
  return { ctx, invoices };
}

export async function getTransactionsData() {
  const ctx = await getWorkspaceContext();
  const transactions = await prisma.transaction.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { transactionDate: "desc" },
    take: 100
  });
  return { ctx, transactions };
}

export async function getGstData() {
  const ctx = await getWorkspaceContext();
  const invoices = await prisma.invoice.findMany({
    where: { workspaceId: ctx.workspaceId, status: { in: ["ISSUED", "PAID", "DRAFT"] } },
    orderBy: [{ invoiceDate: "asc" }]
  });
  const items = await prisma.invoiceItem.findMany({
    where: { workspaceId: ctx.workspaceId, invoiceId: { in: invoices.map((invoice) => invoice.id) } }
  });
  const itemsByInvoice = groupBy(items, (item) => item.invoiceId);
  const gstInvoices: GstInvoiceInput[] = invoices.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    supplierGstin: invoice.sellerGstin ?? undefined,
    supplierStateCode: invoice.sellerStateCode,
    recipientGstin: invoice.buyerGstin ?? undefined,
    recipientName: undefined,
    recipientStateCode: invoice.buyerStateCode ?? undefined,
    placeOfSupplyStateCode: invoice.placeOfSupply ?? invoice.buyerStateCode ?? invoice.sellerStateCode,
    isRecipientRegistered: Boolean(invoice.buyerGstin),
    isExport: invoice.supplyType === "export",
    isSezSupply: invoice.supplyType === "sez",
    reverseCharge: invoice.reverseCharge,
    lines: (itemsByInvoice.get(invoice.id) ?? []).map((item) => ({
      description: item.description,
      hsnSac: item.hsnSac ?? undefined,
      taxableValue: Number(item.taxableValue),
      gstRate: Number(item.taxRate)
    }))
  }));

  const gstr1 = buildGstr1Draft(gstInvoices);
  const gstr3b = buildGstr3bSummary(gstInvoices);
  const validations = [
    ...gstr1.issues.map((issue) => issue.message),
    ...invoices.filter((invoice) => !invoice.buyerGstin).map((invoice) => `${invoice.invoiceNumber}: buyer GSTIN missing or unregistered`),
    ...items.filter((item) => !item.hsnSac).map((item) => `${item.description}: HSN/SAC missing`)
  ];

  const returnPeriod = await ensureCurrentGstReturnPeriod(ctx);
  return { ctx, invoices, gstr1, gstr3b, validations, returnPeriod };
}

export async function getTaxData() {
  const ctx = await getWorkspaceContext();
  const [incomeTransactions, expenseTransactions] = await Promise.all([
    prisma.transaction.findMany({ where: { workspaceId: ctx.workspaceId, kind: "SALE" } }),
    prisma.transaction.findMany({ where: { workspaceId: ctx.workspaceId, kind: "PURCHASE" } })
  ]);

  const income = sum(incomeTransactions.map((transaction) => transaction.amount));
  const expenses = Math.abs(sum(expenseTransactions.map((transaction) => transaction.amount)));
  const eligibility = evaluateSection44ADAEligibility({
    totalGrossReceipts: income,
    cashReceipts: income * 0.02
  });
  const presumptive = estimateSection44ADAPresumptiveIncome({
    totalGrossReceipts: income,
    cashReceipts: income * 0.02
  });
  const comparison = compareRegimes({
    grossIncome: presumptive.deemedIncome,
    oldRegimeDeductions: { chapterVIA: 150_000 }
  });

  return { ctx, income, expenses, eligibility, presumptive, comparison };
}

export async function getOnboardingData() {
  const ctx = await getWorkspaceContext();
  const [business, gstRegistrations, taxProfile, members] = await Promise.all([
    prisma.business.findFirst({ where: { id: ctx.businessId, workspaceId: ctx.workspaceId } }),
    prisma.gstRegistration.findMany({ where: { workspaceId: ctx.workspaceId, businessId: ctx.businessId } }),
    prisma.taxProfile.findFirst({ where: { workspaceId: ctx.workspaceId, businessId: ctx.businessId } }),
    prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" } })
  ]);

  return { ctx, business, gstRegistrations, taxProfile, members };
}

export async function getClientsData() {
  const ctx = await getWorkspaceContext();
  const [parties, invitedMembers, reviewTasks] = await Promise.all([
    prisma.party.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ type: "asc" }, { displayName: "asc" }]
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId: ctx.workspaceId, invitedEmail: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.reviewTask.findMany({
      where: { workspaceId: ctx.workspaceId, entityType: { not: PROJECT_ENTITY_TYPE } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 20
    })
  ]);

  return { ctx, parties, invitedMembers, reviewTasks };
}

export async function getSettingsData() {
  const ctx = await getWorkspaceContext();
  const env = getServerEnv();
  const [members, integrations, auditEvents] = await Promise.all([
    prisma.workspaceMember.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "asc" } }),
    prisma.integrationAccount.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" } }),
    prisma.auditEvent.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 8 })
  ]);

  return {
    ctx,
    members,
    integrations,
    auditEvents,
    ai: {
      provider: env.AI_PROVIDER,
      defaultModel: env.OPENAI_DEFAULT_MODEL,
      allowedModels: env.OPENAI_ALLOWED_MODELS,
      allowsAllModels: isOpenAiModelAllowed("any-model-id", env.OPENAI_ALLOWED_MODELS)
    }
  };
}

export async function getReportsData() {
  const ctx = await getWorkspaceContext();
  const [documents, invoices, transactions, exportJobs] = await Promise.all([
    prisma.document.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.invoice.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.transaction.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.exportJob.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 8 })
  ]);

  return { ctx, counts: { documents, invoices, transactions }, exportJobs };
}

export async function getNorthAmericaDashboardData() {
  const ctx = await getWorkspaceContext();
  const [documentsNeedingReview, aiPending, invoices, bills, transactions] = await Promise.all([
    prisma.document.count({ where: { workspaceId: ctx.workspaceId, status: "NEEDS_REVIEW" } }),
    prisma.aiSuggestion.count({ where: { workspaceId: ctx.workspaceId, status: "PENDING" } }),
    prisma.invoice.findMany({ where: { workspaceId: ctx.workspaceId } }),
    prisma.bill.findMany({ where: { workspaceId: ctx.workspaceId } }),
    prisma.transaction.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { transactionDate: "desc" }, take: 8 })
  ]);
  const sales = sum(invoices.map((invoice) => invoice.total));
  const expenses = sum(bills.map((bill) => bill.total));
  const netProfit = Math.max(0, sales - expenses);
  const taxPlan = buildUsEstimatedTaxPlan({
    grossIncome: sales,
    businessExpenses: expenses,
    filingStatus: "single"
  });
  const nexus = evaluateUsEconomicNexus({
    state: "NY",
    grossRevenue: sales,
    transactionCount: Math.max(invoices.length, 36)
  });
  const form1099K = evaluate1099KThreshold(sales, invoices.length);

  return {
    ctx,
    business: {
      name: "Maple & Main Studio",
      identifier: "US EIN 12-3456789 · NY/NJ/CT/SF launch region",
      fiscalYear: "TY 2026"
    },
    cards: [
      {
        label: "US federal estimate",
        value: taxPlan.remainingEstimatedTax,
        detail: "Schedule C and SE-tax planning from reviewed records",
        status: "Draft"
      },
      {
        label: "Sales-tax nexus",
        value: nexus.status === "registration_review" ? "Review" : "Monitor",
        detail: nexus.reasons.join(" "),
        status: nexus.status === "registration_review" ? "Review" : "Ready"
      },
      {
        label: "Launch region",
        value: "NY/NJ/CT/SF",
        detail: "Rates and nexus checks are scoped to the first-client launch jurisdictions",
        status: "Focused"
      },
      {
        label: "AI actions",
        value: String(aiPending),
        detail: `${documentsNeedingReview} documents need review before tax packs update`,
        status: aiPending > 0 ? "Approval" : "Clear"
      }
    ],
    money: {
      sales,
      expenses,
      netProfit,
      estimatedTax: taxPlan.remainingEstimatedTax
    },
    taxPlan,
    form1099K,
    transactions,
    ruleVersions: [US_TY_2026_RULE_METADATA.ruleVersion, CA_2026_RULE_METADATA.ruleVersion]
  };
}

export async function getNorthAmericaTaxData() {
  const dashboard = await getNorthAmericaDashboardData();
  const mileageDeduction = calculateBusinessMileageDeduction(3_420);
  const form1099K = evaluate1099KThreshold(dashboard.money.sales, 236);
  return {
    ...dashboard,
    mileageDeduction,
    form1099K,
    sourceNotes: [
      "US federal outputs are Schedule C / 1040-ES planning, not official filing.",
      "Sales-tax outputs are scoped to New York, New Jersey, Connecticut, and San Francisco launch workflows."
    ]
  };
}

export async function getNorthAmericaSalesTaxData() {
  const ctx = await getWorkspaceContext();
  const states: UsStateCode[] = ["NY", "NJ", "CT", "CA"];
  const revenueByState: Record<UsStateCode, number> = {
    NY: 525_000,
    NJ: 118_000,
    CT: 96_000,
    CA: 310_000
  };
  const transactionsByState: Record<UsStateCode, number> = {
    NY: 126,
    NJ: 212,
    CT: 188,
    CA: 60
  };
  const nexusChecks = states.map((state, index) =>
    evaluateUsEconomicNexus({
      state,
      grossRevenue: revenueByState[state] ?? 0,
      transactionCount: transactionsByState[state] ?? 0,
      marketplaceOnly: index === 3
    })
  );
  const sampleJurisdictions: UsLaunchJurisdictionCode[] = ["NYC", "NJ", "CT", "SF"];
  const sampleSalesTax = sampleJurisdictions.map((destinationJurisdiction) =>
    calculateUsSalesTax({ destinationJurisdiction, taxableAmount: 1_000 })
  );
  const ctSpecialRates = [
    calculateUsSalesTax({
      destinationJurisdiction: "CT",
      taxableAmount: 1_000,
      taxabilityCode: "ct_computer_data_processing"
    }),
    calculateUsSalesTax({
      destinationJurisdiction: "CT",
      taxableAmount: 1_000,
      taxabilityCode: "ct_meals"
    })
  ];

  return {
    ctx,
    supportedJurisdictions: listLaunchSalesTaxJurisdictions(),
    nexusChecks,
    sampleSalesTax,
    ctSpecialRates,
    ruleVersions: [US_TY_2026_RULE_METADATA.ruleVersion, CA_2026_RULE_METADATA.ruleVersion]
  };
}

export async function getAssistantWorkspaceData(region: "india" | "north-america", query?: string, projectId?: string) {
  const ctx = await getWorkspaceContext();
  const projectTask = projectId ? await findActiveProject(ctx, projectId) : null;
  const documentWhere = projectTask ? projectDocumentWhere(ctx, projectTask) : { workspaceId: ctx.workspaceId };
  const documents = await prisma.document.findMany({
    where: documentWhere,
    orderBy: { createdAt: "desc" },
    take: 8
  });
  const documentIds = documents.map((document) => document.id);
  const scopedDocumentIds = documentIds.length > 0 ? documentIds : ["__no_project_documents__"];
  const isProjectDefault = projectTask ? isDefaultProject(ctx, projectTask) : true;
  const [
    transactions,
    invoices,
    bills,
    suggestions,
    reviewTasks,
    exportJobs
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: isProjectDefault
        ? { workspaceId: ctx.workspaceId }
        : { workspaceId: ctx.workspaceId, sourceDocumentId: { in: scopedDocumentIds } },
      orderBy: { transactionDate: "desc" },
      take: 8
    }),
    prisma.invoice.findMany({
      where: isProjectDefault
        ? { workspaceId: ctx.workspaceId }
        : { workspaceId: ctx.workspaceId, documentId: { in: scopedDocumentIds } },
      orderBy: { invoiceDate: "desc" },
      take: 8
    }),
    prisma.bill.findMany({
      where: isProjectDefault
        ? { workspaceId: ctx.workspaceId }
        : { workspaceId: ctx.workspaceId, documentId: { in: scopedDocumentIds } },
      orderBy: { billDate: "desc" },
      take: 8
    }),
    prisma.aiSuggestion.findMany({
      where: { workspaceId: ctx.workspaceId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 6
    }),
    prisma.reviewTask.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        entityType: { not: PROJECT_ENTITY_TYPE }
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 8
    }),
    prisma.exportJob.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 4
    })
  ]);

  const money = {
    income: sum(invoices.map((invoice) => invoice.total)),
    expenses: sum(bills.map((bill) => bill.total)),
    receivables: sum(invoices.filter((invoice) => invoice.status !== "PAID" && invoice.status !== "CANCELLED").map((invoice) => invoice.total))
  };
  const project = projectTask ? await summarizeProject(ctx, region, projectTask) : null;
  const docsNeedingReview = documents.filter((document) => document.status === "NEEDS_REVIEW" || document.status === "EXTRACTED");
  const pendingCount = docsNeedingReview.length + suggestions.length + reviewTasks.length;

  return {
    ctx,
    region,
    title: region === "north-america" ? "LedgerAI NY/NJ/CT/SF" : "LedgerAI India",
    project,
    money,
    pendingCount,
    documents,
    docsNeedingReview,
    transactions,
    invoices,
    bills,
    suggestions,
    reviewTasks,
    exportJobs,
    answer: buildAssistantAnswer({
      region,
      query: query ?? "",
      project,
      money,
      documents,
      transactions,
      invoices,
      bills,
      suggestions,
      reviewTasks
    })
  };
}

export async function getWorkflowHubData(region: "india" | "north-america") {
  const assistant = await getAssistantWorkspaceData(region);
  const [gst, tax, naTax, salesTax] = await Promise.all([
    region === "india" ? getGstData() : Promise.resolve(null),
    region === "india" ? getTaxData() : Promise.resolve(null),
    region === "north-america" ? getNorthAmericaTaxData() : Promise.resolve(null),
    region === "north-america" ? getNorthAmericaSalesTaxData() : Promise.resolve(null)
  ]);

  return { ...assistant, gst, tax, naTax, salesTax };
}

export async function getInvoicePrintData(invoiceId: string) {
  const ctx = await getWorkspaceContext();
  const [business, invoice, items] = await Promise.all([
    prisma.business.findFirst({ where: { id: ctx.businessId, workspaceId: ctx.workspaceId } }),
    prisma.invoice.findFirst({ where: { id: invoiceId, workspaceId: ctx.workspaceId } }),
    prisma.invoiceItem.findMany({ where: { workspaceId: ctx.workspaceId, invoiceId }, orderBy: { createdAt: "asc" } })
  ]);
  if (!invoice) return null;

  const party = invoice.partyId
    ? await prisma.party.findFirst({ where: { id: invoice.partyId, workspaceId: ctx.workspaceId } })
    : null;

  return { ctx, business, invoice, items, party };
}

export async function createProject(formData: FormData) {
  const ctx = await getWorkspaceContext();
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), "/app/projects");
  const title = requiredString(formData, "name").slice(0, 100);
  const project = await prisma.reviewTask.create({
    data: {
      workspaceId: ctx.workspaceId,
      title,
      description: "Project workspace",
      status: "OPEN",
      entityType: PROJECT_ENTITY_TYPE,
      createdById: ctx.userId
    }
  });

  await audit(ctx, "create", PROJECT_ENTITY_TYPE, project.id, undefined, { title });
  revalidateProjectPaths(project.id);
  redirect(`${returnTo.replace(/\/$/, "")}/${project.id}`);
}

export async function renameProject(formData: FormData) {
  const ctx = await getWorkspaceContext();
  const projectId = requiredString(formData, "projectId");
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), "/app/projects");
  const title = requiredString(formData, "name").slice(0, 100);
  const project = await findActiveProject(ctx, projectId);
  if (!project) throw new Error("Project not found.");

  await prisma.reviewTask.update({
    where: { id: project.id },
    data: { title }
  });

  if (isDefaultProject(ctx, project)) {
    await prisma.workspace.update({
      where: { id: ctx.workspaceId },
      data: { name: title }
    });
  }

  await audit(ctx, "rename", PROJECT_ENTITY_TYPE, project.id, project, { title });
  revalidateProjectPaths(project.id);
  redirect(returnTo);
}

export async function deleteProject(formData: FormData) {
  const ctx = await getWorkspaceContext();
  const projectId = requiredString(formData, "projectId");
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), "/app/projects");
  const project = await findActiveProject(ctx, projectId);
  if (!project) throw new Error("Project not found.");

  await prisma.reviewTask.update({
    where: { id: project.id },
    data: { status: "CLOSED" }
  });

  await audit(ctx, "delete", PROJECT_ENTITY_TYPE, project.id, project, { status: "CLOSED" });
  revalidateProjectPaths(project.id);
  redirect(returnTo);
}

export async function uploadDocument(formData: FormData) {
  const ctx = await getWorkspaceContext();
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), "/app/vault");
  const projectId = optionalString(formData, "projectId");
  const project = projectId ? await findActiveProject(ctx, projectId) : null;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a file to upload.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const storage = getLocalStorage();
  const stored = await storage.putObject({
    key: `${ctx.workspaceId}/${Date.now()}-${sanitizeFileName(file.name)}`,
    body: bytes,
    contentType: file.type || "application/octet-stream",
    metadata: { originalFilename: file.name }
  });

  const document = await prisma.document.create({
    data: {
      workspaceId: ctx.workspaceId,
      businessId: ctx.businessId,
      uploadedById: ctx.userId,
      status: "PROCESSING",
      type: "UNKNOWN",
      originalFilename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      storageBucket: "local-private",
      storageKey: stored.key,
      checksumSha256: stored.checksumSha256,
      metadata: {
        upload: { originalFilename: file.name, contentType: file.type },
        ...(project ? { projectId: project.id, projectName: project.title } : {})
      },
      createdById: ctx.userId
    }
  });

  await audit(ctx, "upload", "document", document.id, undefined, {
    filename: file.name,
    checksumSha256: stored.checksumSha256
  });

  await extractAndPersistDocument(ctx, document, bytes, "initial");

  revalidatePath("/app/inbox");
  revalidatePath("/app/vault");
  if (project) revalidateProjectPaths(project.id);
  redirect(documentReviewPath(returnTo, document.id));
}

export async function rerunDocumentExtraction(formData: FormData) {
  const ctx = await getWorkspaceContext();
  const documentId = requiredString(formData, "documentId");
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), `/app/vault/${documentId}`);
  const document = await prisma.document.findFirst({
    where: { id: documentId, workspaceId: ctx.workspaceId }
  });
  if (!document) throw new Error("Document not found.");

  const before = document;
  await prisma.document.update({
    where: { id: document.id },
    data: { status: "PROCESSING" }
  });

  const stored = await getLocalStorage().getObject({ key: document.storageKey });
  const extraction = await extractAndPersistDocument(ctx, document, stored.body, "rerun");
  await prisma.documentReviewEvent.create({
    data: {
      workspaceId: ctx.workspaceId,
      documentId: document.id,
      extractionId: extraction.id,
      reviewerId: ctx.userId,
      action: "rerun_extraction",
      metadata: fieldJson({ provider: "document_ocr_pipeline" })
    }
  });
  await audit(ctx, "rerun_extraction", "document", document.id, before, {
    extractionId: extraction.id
  });

  revalidatePath("/app/inbox");
  revalidatePath("/app/vault");
  revalidatePath(`/app/inbox/${document.id}`);
  revalidatePath(`/app/vault/${document.id}`);
  redirect(returnTo);
}

export async function rejectDocument(formData: FormData) {
  const ctx = await getWorkspaceContext();
  const documentId = requiredString(formData, "documentId");
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), "/app/vault");
  const document = await prisma.document.findFirst({
    where: { id: documentId, workspaceId: ctx.workspaceId }
  });
  if (!document) throw new Error("Document not found.");

  const latestExtraction = await prisma.documentExtraction.findFirst({
    where: { workspaceId: ctx.workspaceId, documentId: document.id },
    orderBy: { createdAt: "desc" }
  });

  await prisma.document.update({
    where: { id: document.id },
    data: { status: "REJECTED" }
  });
  if (latestExtraction) {
    await prisma.documentExtraction.update({
      where: { id: latestExtraction.id },
      data: { status: "INVALID", reviewerId: ctx.userId, reviewedAt: new Date() }
    });
  }
  await prisma.documentReviewEvent.create({
    data: {
      workspaceId: ctx.workspaceId,
      documentId: document.id,
      extractionId: latestExtraction?.id,
      reviewerId: ctx.userId,
      action: "reject",
      metadata: fieldJson({ reason: "Rejected by reviewer before posting" })
    }
  });
  await audit(ctx, "reject", "document", document.id, document, { status: "REJECTED" });

  revalidatePath("/app/inbox");
  revalidatePath("/app/vault");
  redirect(returnTo);
}

export async function approveDocument(formData: FormData) {
  const ctx = await getWorkspaceContext();
  const documentId = requiredString(formData, "documentId");
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), "/app/vault");
  const data = await getDocumentReviewData(documentId);
  if (!data?.document || !data.extraction) throw new Error("Document extraction not found.");

  const edited = Object.fromEntries(
    Array.from(formData.entries())
      .filter(([key]) => key.startsWith("field:"))
      .map(([key, value]) => [key.replace("field:", ""), String(value)])
  ) as Record<string, string>;

  await Promise.all(
    data.fields.map((field) =>
      prisma.documentExtractionField.update({
        where: { id: field.id },
        data: {
          reviewerValue: fieldJson(edited[field.fieldPath] ?? ""),
          correctedById: ctx.userId,
          correctedAt: new Date(),
          validationStatus: "VALID"
        }
      })
    )
  );

  const type = edited.documentType?.toLowerCase() ?? data.document.type.toLowerCase();
  if (type.includes("bank") || data.document.type === "BANK_STATEMENT") {
    await postBankStatementFromExtraction(ctx, data.document.id, data.document.metadata, edited);
  } else if (type.includes("bill") || data.document.type === "PURCHASE_BILL") {
    await postBillFromExtraction(ctx, data.document.id, edited);
  } else if (type.includes("invoice") || data.document.type === "SALES_INVOICE") {
    await postInvoiceFromExtraction(ctx, data.document.id, edited);
  } else {
    await postGenericTransaction(ctx, data.document.id, edited);
  }

  await prisma.document.update({
    where: { id: data.document.id },
    data: { status: "POSTED", currentExtractionId: data.extraction.id }
  });
  await prisma.documentExtraction.update({
    where: { id: data.extraction.id },
    data: { status: "VALID", reviewerId: ctx.userId, reviewedAt: new Date() }
  });
  await prisma.documentReviewEvent.create({
    data: {
      workspaceId: ctx.workspaceId,
      documentId: data.document.id,
      extractionId: data.extraction.id,
      reviewerId: ctx.userId,
      action: "approve_and_post",
      metadata: fieldJson({ fields: edited })
    }
  });
  await audit(ctx, "human_approval", "document", data.document.id, undefined, edited);

  revalidatePath("/app");
  revalidatePath("/app/vault");
  revalidatePath("/app/assistant");
  redirect(returnTo);
}

export async function createInvoice(formData: FormData) {
  const ctx = await getWorkspaceContext();
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), "/app/workflows");
  const customerName = requiredString(formData, "customerName");
  const invoiceNumber = requiredString(formData, "invoiceNumber");
  const invoiceDate = requiredString(formData, "invoiceDate");
  const buyerGstin = optionalString(formData, "buyerGstin");
  const buyerStateCode = optionalString(formData, "buyerStateCode") ?? "29";
  const placeOfSupply = optionalString(formData, "placeOfSupply") ?? buyerStateCode;
  const description = requiredString(formData, "description");
  const hsnSac = optionalString(formData, "hsnSac");
  const quantity = Number(formData.get("quantity") || 1);
  const unitPrice = Number(formData.get("unitPrice") || 0);
  const taxRate = Number(formData.get("taxRate") || 18);
  const taxableValue = round(quantity * unitPrice);
  const tax = calculateGstTax({
    taxableValue,
    gstRate: taxRate,
    supplierStateCode: ctx.stateCode,
    placeOfSupplyStateCode: placeOfSupply
  });

  const party = await upsertParty(ctx, customerName, "CUSTOMER", buyerGstin, buyerStateCode);
  const invoice = await prisma.invoice.create({
    data: {
      workspaceId: ctx.workspaceId,
      businessId: ctx.businessId,
      partyId: party.id,
      kind: "GST_INVOICE",
      status: "ISSUED",
      invoiceNumber,
      invoiceDate: new Date(invoiceDate),
      sellerGstin: ctx.gstin,
      buyerGstin,
      sellerStateCode: ctx.stateCode,
      buyerStateCode,
      placeOfSupply,
      supplyType: buyerStateCode === "96" ? "export" : "taxable",
      taxableValue,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      cess: tax.cess,
      total: tax.invoiceValue,
      notes: optionalString(formData, "notes"),
      terms: optionalString(formData, "terms"),
      issuedAt: new Date(),
      createdById: ctx.userId
    }
  });

  await prisma.invoiceItem.create({
    data: {
      workspaceId: ctx.workspaceId,
      invoiceId: invoice.id,
      description,
      hsnSac,
      quantity,
      unitPrice,
      taxRate,
      taxableValue,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      cess: tax.cess,
      total: tax.invoiceValue
    }
  });

  await createTransactionForInvoice(ctx, invoice.id, {
    invoiceDate,
    customerName,
    taxableValue,
    cgst: tax.cgst,
    sgst: tax.sgst,
    igst: tax.igst,
    total: tax.invoiceValue
  });

  await audit(ctx, "create", "invoice", invoice.id, undefined, { invoiceNumber, total: tax.invoiceValue });
  revalidatePath("/app");
  redirect(returnTo);
}

export async function saveOnboarding(formData: FormData) {
  const ctx = await getWorkspaceContext();
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), "/app/settings");
  const businessName = requiredString(formData, "businessName");
  const legalType = enumValue(requiredString(formData, "legalType"), ["INDIVIDUAL", "PROPRIETORSHIP", "PARTNERSHIP", "LLP", "COMPANY"] as const);
  const pan = requiredString(formData, "pan").toUpperCase();
  const gstin = optionalString(formData, "gstin")?.toUpperCase();
  const stateCode = requiredString(formData, "stateCode");
  const businessType = enumValue(requiredString(formData, "businessType"), ["SERVICES", "TRADING", "MANUFACTURING", "MIXED", "EXPORT", "PROFESSIONAL"] as const);
  const filingFrequency = enumValue(requiredString(formData, "filingFrequency"), ["MONTHLY", "QUARTERLY_QRMP"] as const);
  const taxProfileKind = enumValue(requiredString(formData, "taxProfileKind"), ["PROFESSIONAL", "BUSINESS", "SALARY_PLUS_FREELANCING", "EXPORT_SERVICES"] as const);
  const turnoverEstimate = numberOr(optionalString(formData, "turnoverEstimate"), 0);

  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    throw new Error("PAN must match the 10-character Indian PAN format.");
  }
  if (gstin) {
    const gstinValidation = validateGstin(gstin);
    if (!gstinValidation.valid) {
      throw new Error(gstinValidation.issues.map((issue) => issue.message).join(" "));
    }
  }

  const before = await prisma.business.findFirst({ where: { id: ctx.businessId, workspaceId: ctx.workspaceId } });
  const business = await prisma.business.update({
    where: { id: ctx.businessId },
    data: {
      name: businessName,
      legalName: optionalString(formData, "legalName") ?? businessName,
      legalType,
      pan,
      primaryStateCode: stateCode,
      businessType,
      turnoverEstimate,
      onboardingComplete: true,
      preferredInvoiceFormat: optionalString(formData, "preferredInvoiceFormat") ?? "gst_invoice"
    }
  });

  if (gstin) {
    await prisma.gstRegistration.upsert({
      where: { workspaceId_gstin: { workspaceId: ctx.workspaceId, gstin } },
      update: {
        businessId: business.id,
        stateCode,
        legalName: business.legalName,
        filingFrequency,
        compositionScheme: formData.get("compositionScheme") === "on"
      },
      create: {
        workspaceId: ctx.workspaceId,
        businessId: business.id,
        gstin,
        stateCode,
        legalName: business.legalName,
        filingFrequency,
        compositionScheme: formData.get("compositionScheme") === "on",
        createdById: ctx.userId
      }
    });
  }

  await prisma.taxProfile.upsert({
    where: { id: `${business.id}-tax-profile` },
    update: {
      kind: taxProfileKind,
      presumptiveSection: optionalString(formData, "presumptiveSection"),
      cashReceiptsPercent: numberOr(optionalString(formData, "cashReceiptsPercent"), 2),
      optedOutOfNewRegime: formData.get("optedOutOfNewRegime") === "on",
      form10IeaRequired: taxProfileKind !== "SALARY_PLUS_FREELANCING" && formData.get("optedOutOfNewRegime") === "on"
    },
    create: {
      id: `${business.id}-tax-profile`,
      workspaceId: ctx.workspaceId,
      businessId: business.id,
      kind: taxProfileKind,
      assessmentYear: "AY2026-27",
      presumptiveSection: optionalString(formData, "presumptiveSection"),
      cashReceiptsPercent: numberOr(optionalString(formData, "cashReceiptsPercent"), 2),
      optedOutOfNewRegime: formData.get("optedOutOfNewRegime") === "on",
      form10IeaRequired: taxProfileKind !== "SALARY_PLUS_FREELANCING" && formData.get("optedOutOfNewRegime") === "on",
      createdById: ctx.userId
    }
  });

  await audit(ctx, "update", "business", business.id, before, { businessName, pan, gstin, filingFrequency, taxProfileKind });
  revalidatePath("/app");
  redirect(returnTo);
}

export async function inviteWorkspaceMember(formData: FormData) {
  const ctx = await getWorkspaceContext();
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), "/app/workflows");
  const invitedEmail = requiredString(formData, "invitedEmail").toLowerCase();
  const role = enumValue(requiredString(formData, "role"), ["OWNER", "ADMIN", "ACCOUNTANT", "REVIEWER", "STAFF", "CLIENT_READONLY"] as const);

  const member = await prisma.workspaceMember.create({
    data: {
      workspaceId: ctx.workspaceId,
      invitedEmail,
      role,
      status: "INVITED",
      createdById: ctx.userId
    }
  });
  await audit(ctx, "invite", "workspace_member", member.id, undefined, { invitedEmail, role });
  revalidatePath("/app/clients");
  revalidatePath("/app/settings");
  revalidatePath("/app/workflows");
  redirect(returnTo);
}

export async function createDocumentRequest(formData: FormData) {
  const ctx = await getWorkspaceContext();
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), "/app/workflows");
  const title = requiredString(formData, "title");
  const contact = optionalString(formData, "contact");
  const dueDate = optionalString(formData, "dueDate");
  const task = await prisma.reviewTask.create({
    data: {
      workspaceId: ctx.workspaceId,
      title,
      description: contact ? `Request contact: ${contact}` : optionalString(formData, "description"),
      entityType: "document_request",
      status: "OPEN",
      dueDate: dueDate ? new Date(dueDate) : undefined,
      createdById: ctx.userId
    }
  });
  await audit(ctx, "create", "review_task", task.id, undefined, { title, contact, dueDate });
  revalidatePath("/app/clients");
  revalidatePath("/app/workflows");
  redirect(returnTo);
}

export async function saveIntegrationAccount(formData: FormData) {
  const ctx = await getWorkspaceContext();
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), "/app/settings");
  const provider = oneOf(requiredString(formData, "provider"), ["gsp_sandbox", "gmail", "google_drive", "razorpay", "tally"] as const);
  const label = requiredString(formData, "label");
  const existing = await prisma.integrationAccount.findFirst({ where: { workspaceId: ctx.workspaceId, provider } });
  const integration = existing
    ? await prisma.integrationAccount.update({
        where: { id: existing.id },
        data: { label, status: "CONFIGURED" }
      })
    : await prisma.integrationAccount.create({
        data: {
          workspaceId: ctx.workspaceId,
          provider,
          label,
          status: "CONFIGURED",
          scopes: { mode: "manual_or_sandbox", externalSubmissionRequiresApproval: true },
          connectedById: ctx.userId
        }
      });

  await audit(ctx, "integration_credential_update", "integration_account", integration.id, existing, {
    provider,
    label,
    status: integration.status
  });
  revalidatePath("/app/settings");
  redirect(returnTo);
}

export async function updateGstReturnStatus(formData: FormData) {
  const ctx = await getWorkspaceContext();
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), "/app/workflows");
  const action = requiredString(formData, "action");
  const returnPeriod = await ensureCurrentGstReturnPeriod(ctx);
  const before = returnPeriod;
  const data =
    action === "mark_filed"
      ? { status: "FILED_EXTERNALLY" as const, filedAt: new Date() }
      : action === "lock"
        ? { status: "LOCKED" as const, lockedAt: new Date() }
        : { status: "IN_REVIEW" as const, filedAt: null, lockedAt: null };

  const updated = await prisma.gstReturnPeriod.update({
    where: { id: returnPeriod.id },
    data
  });
  await audit(ctx, action, "gst_return_period", updated.id, before, updated);
  revalidatePath("/app/gst");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/workflows");
  redirect(returnTo);
}

export async function queueInvoiceEmail(formData: FormData) {
  const ctx = await getWorkspaceContext();
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), "/app/workflows");
  const invoiceId = requiredString(formData, "invoiceId");
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, workspaceId: ctx.workspaceId } });
  if (!invoice) throw new Error("Invoice not found.");

  const task = await prisma.reviewTask.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: `Send invoice ${invoice.invoiceNumber}`,
      description: "Email delivery is queued as a review task until a mail provider is connected.",
      entityType: "invoice",
      entityId: invoice.id,
      status: "OPEN",
      createdById: ctx.userId
    }
  });
  await audit(ctx, "create", "review_task", task.id, undefined, { invoiceId, purpose: "invoice_email" });
  revalidatePath("/app/invoices");
  revalidatePath("/app/workflows");
  redirect(returnTo);
}

export async function reviewAiSuggestion(formData: FormData) {
  const ctx = await getWorkspaceContext();
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), "/app/assistant");
  const suggestionId = requiredString(formData, "suggestionId");
  const action = requiredString(formData, "action");
  const suggestion = await prisma.aiSuggestion.findFirst({ where: { id: suggestionId, workspaceId: ctx.workspaceId } });
  if (!suggestion) throw new Error("Suggestion not found.");

  const status = action === "accept" ? "ACCEPTED" : action === "edit" ? "EDITED" : "REJECTED";
  await prisma.aiSuggestion.update({
    where: { id: suggestion.id },
    data: { status, reviewedById: ctx.userId, reviewedAt: new Date() }
  });
  if (status === "ACCEPTED") {
    await prisma.reviewTask.create({
      data: {
        workspaceId: ctx.workspaceId,
        title: suggestion.title,
        description: suggestion.description,
        entityType: suggestion.entityType ?? "ai_suggestion",
        entityId: suggestion.entityId ?? suggestion.id,
        status: "OPEN",
        createdById: ctx.userId
      }
    });
  }
  await audit(ctx, "human_approval", "ai_suggestion", suggestion.id, suggestion, { status });
  revalidatePath("/app/dashboard");
  revalidatePath("/app/assistant");
  revalidatePath("/app/workflows");
  redirect(returnTo);
}

export async function buildTransactionsCsvExport() {
  const { ctx, transactions } = await getTransactionsData();
  const rows = transactions.map((transaction) => ({
    date: transaction.transactionDate.toISOString().slice(0, 10),
    kind: transaction.kind,
    description: transaction.description,
    category: transaction.category,
    gstTreatment: transaction.gstTreatment,
    status: transaction.status,
    amount: Number(transaction.amount)
  }));
  await recordExport(ctx, "transactions_csv", { rows: rows.length });
  return toCsv(rows);
}

export async function buildGstJsonExport() {
  const data = await getGstData();
  const payload = {
    generatedAt: new Date().toISOString(),
    workspaceId: data.ctx.workspaceId,
    gstin: data.ctx.gstin,
    period: {
      start: data.returnPeriod.periodStart.toISOString().slice(0, 10),
      end: data.returnPeriod.periodEnd.toISOString().slice(0, 10),
      status: data.returnPeriod.status
    },
    gstr1: data.gstr1,
    gstr3b: data.gstr3b,
    validations: data.validations,
    sourceInvoices: data.invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
      taxableValue: Number(invoice.taxableValue),
      cgst: Number(invoice.cgst),
      sgst: Number(invoice.sgst),
      igst: Number(invoice.igst),
      total: Number(invoice.total)
    }))
  };
  await recordExport(data.ctx, "gst_json", { invoices: data.invoices.length, validations: data.validations.length });
  return JSON.stringify(payload, null, 2);
}

export async function buildGstCsvExport() {
  const data = await getGstData();
  const rows = data.invoices.map((invoice) => ({
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    sellerGstin: invoice.sellerGstin,
    buyerGstin: invoice.buyerGstin,
    taxableValue: Number(invoice.taxableValue),
    cgst: Number(invoice.cgst),
    sgst: Number(invoice.sgst),
    igst: Number(invoice.igst),
    total: Number(invoice.total),
    status: invoice.status
  }));
  await recordExport(data.ctx, "gst_csv", { invoices: rows.length });
  return toCsv(rows);
}

export async function buildTaxPlanningJsonExport() {
  const data = await getTaxData();
  const payload = {
    generatedAt: new Date().toISOString(),
    workspaceId: data.ctx.workspaceId,
    assessmentYear: "AY2026-27",
    income: data.income,
    expenses: data.expenses,
    presumptiveEligibility: data.eligibility,
    presumptiveEstimate: data.presumptive,
    regimeComparison: data.comparison,
    label: "Draft planning output; review before filing."
  };
  await recordExport(data.ctx, "tax_planning_json", { income: data.income });
  return JSON.stringify(payload, null, 2);
}

export async function buildInvoicePackCsvExport() {
  const { ctx, invoices } = await getInvoicesData();
  const rows = invoices.map((invoice) => ({
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    buyerGstin: invoice.buyerGstin,
    taxableValue: Number(invoice.taxableValue),
    cgst: Number(invoice.cgst),
    sgst: Number(invoice.sgst),
    igst: Number(invoice.igst),
    total: Number(invoice.total),
    status: invoice.status,
    printUrl: `/app/invoices/${invoice.id}/print`
  }));
  await recordExport(ctx, "invoice_pack_csv", { invoices: rows.length });
  return toCsv(rows);
}

async function seedSampleRecordsIfEmpty(ctx: Pick<WorkspaceContext, "workspaceId" | "businessId" | "userId">) {
  const seedInvoices = [
    {
      invoiceNumber: "NS/26-27/0041",
      customerName: "Northstar Media",
      buyerGstin: "27AAPFU0939F1ZV",
      buyerStateCode: "27",
      date: "2026-04-18",
      description: "Campaign analytics project",
      hsnSac: "998314",
      taxableValue: 150_000,
      taxRate: 18
    },
    {
      invoiceNumber: "NS/26-27/0042",
      customerName: "Acme Labs Pvt Ltd",
      buyerGstin: "29AABCU9603R1ZJ",
      buyerStateCode: "29",
      date: "2026-04-30",
      description: "AI-assisted monthly design retainer",
      hsnSac: "998314",
      taxableValue: 80_000,
      taxRate: 18
    }
  ];

  for (const invoice of seedInvoices) {
    const exists = await prisma.invoice.findFirst({
      where: { workspaceId: ctx.workspaceId, businessId: ctx.businessId, invoiceNumber: invoice.invoiceNumber }
    });
    if (!exists) await createSeedInvoice(ctx, invoice);
  }

  const billExists = await prisma.bill.findFirst({
    where: { workspaceId: ctx.workspaceId, businessId: ctx.businessId, billNumber: "PC-APR-0426" }
  });
  if (!billExists) {
    await createSeedBill(ctx, {
      billNumber: "PC-APR-0426",
      supplierName: "PixelCloud Hosting",
      supplierGstin: "29AAPFU0939F1Z1",
      date: "2026-04-28",
      description: "Cloud hosting bill",
      hsnSac: "998315",
      taxableValue: 68_000,
      taxRate: 18,
      itcEligible: true
    });
  }

  for (const suggestion of [
    {
      title: "Classify PixelCloud as software expense",
      description: "Based on supplier memory and bill description.",
      proposedPatch: { category: "software" },
      citations: [{ entityType: "bill", label: "PixelCloud Hosting" }]
    },
    {
      title: "Create April GST review task",
      description: "Open validations exist for current GST period.",
      proposedPatch: { task: "April GST review" },
      citations: [{ entityType: "gst_period", label: "April 2026" }]
    }
  ]) {
    const exists = await prisma.aiSuggestion.findFirst({
      where: { workspaceId: ctx.workspaceId, title: suggestion.title, status: "PENDING" }
    });
    if (!exists) {
      await prisma.aiSuggestion.create({
        data: {
          workspaceId: ctx.workspaceId,
          status: "PENDING",
          createdById: ctx.userId,
          ...suggestion
        }
      });
    }
  }
}

async function createSeedInvoice(ctx: Pick<WorkspaceContext, "workspaceId" | "businessId" | "userId">, input: {
  invoiceNumber: string;
  customerName: string;
  buyerGstin: string;
  buyerStateCode: string;
  date: string;
  description: string;
  hsnSac: string;
  taxableValue: number;
  taxRate: number;
}) {
  const tax = calculateGstTax({
    taxableValue: input.taxableValue,
    gstRate: input.taxRate,
    supplierStateCode: "27",
    placeOfSupplyStateCode: input.buyerStateCode
  });
  const party = await upsertParty(ctx, input.customerName, "CUSTOMER", input.buyerGstin, input.buyerStateCode);
  const invoice = await prisma.invoice.create({
    data: {
      workspaceId: ctx.workspaceId,
      businessId: ctx.businessId,
      partyId: party.id,
      status: "ISSUED",
      invoiceNumber: input.invoiceNumber,
      invoiceDate: new Date(input.date),
      sellerGstin: "27AAQCS4259Q1ZP",
      buyerGstin: input.buyerGstin,
      sellerStateCode: "27",
      buyerStateCode: input.buyerStateCode,
      placeOfSupply: input.buyerStateCode,
      taxableValue: input.taxableValue,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      total: tax.invoiceValue,
      issuedAt: new Date(input.date),
      createdById: ctx.userId
    }
  });
  await prisma.invoiceItem.create({
    data: {
      workspaceId: ctx.workspaceId,
      invoiceId: invoice.id,
      description: input.description,
      hsnSac: input.hsnSac,
      quantity: 1,
      unitPrice: input.taxableValue,
      taxRate: input.taxRate,
      taxableValue: input.taxableValue,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      total: tax.invoiceValue
    }
  });
  await createTransactionForInvoice(ctx, invoice.id, {
    invoiceDate: input.date,
    customerName: input.customerName,
    taxableValue: input.taxableValue,
    cgst: tax.cgst,
    sgst: tax.sgst,
    igst: tax.igst,
    total: tax.invoiceValue
  });
}

async function createSeedBill(ctx: Pick<WorkspaceContext, "workspaceId" | "businessId" | "userId">, input: {
  billNumber: string;
  supplierName: string;
  supplierGstin: string;
  date: string;
  description: string;
  hsnSac: string;
  taxableValue: number;
  taxRate: number;
  itcEligible: boolean;
}) {
  const tax = calculateGstTax({
    taxableValue: input.taxableValue,
    gstRate: input.taxRate,
    supplierStateCode: "29",
    placeOfSupplyStateCode: "27"
  });
  const party = await upsertParty(ctx, input.supplierName, "SUPPLIER", input.supplierGstin, "29");
  const bill = await prisma.bill.create({
    data: {
      workspaceId: ctx.workspaceId,
      businessId: ctx.businessId,
      partyId: party.id,
      status: "ISSUED",
      billNumber: input.billNumber,
      billDate: new Date(input.date),
      sellerGstin: input.supplierGstin,
      buyerGstin: "27AAQCS4259Q1ZP",
      placeOfSupply: "27",
      taxableValue: input.taxableValue,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      total: tax.invoiceValue,
      itcEligible: input.itcEligible,
      createdById: ctx.userId
    }
  });
  await prisma.billItem.create({
    data: {
      workspaceId: ctx.workspaceId,
      billId: bill.id,
      description: input.description,
      hsnSac: input.hsnSac,
      quantity: 1,
      unitPrice: input.taxableValue,
      taxRate: input.taxRate,
      taxableValue: input.taxableValue,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      total: tax.invoiceValue
    }
  });
  await createTransactionForBill(ctx, bill.id, {
    billDate: input.date,
    supplierName: input.supplierName,
    categoryAccountCode: "5000",
    taxableValue: input.taxableValue,
    cgst: tax.cgst,
    sgst: tax.sgst,
    igst: tax.igst,
    total: tax.invoiceValue,
    itcEligible: input.itcEligible
  });
}

async function postInvoiceFromExtraction(ctx: WorkspaceContext, documentId: string, data: Record<string, string>) {
  const invoiceNumber = data.documentNumber || `UPL-${Date.now()}`;
  const invoiceDate = data.documentDate || new Date().toISOString().slice(0, 10);
  const buyerName = data.buyerName || "Uploaded customer";
  const buyerGstin = data.buyerGstin || undefined;
  const buyerStateCode = buyerGstin?.slice(0, 2) || data.placeOfSupply?.slice(0, 2) || ctx.stateCode;
  const taxableValue = numberOr(data.taxableValue, numberOr(data.subtotal, numberOr(data.totalAmount, 0) / 1.18));
  const total = numberOr(data.totalAmount, taxableValue);
  const taxRate = taxableValue > 0 ? round(((total - taxableValue) / taxableValue) * 100) : 18;
  const tax = calculateGstTax({
    taxableValue,
    gstRate: Number.isFinite(taxRate) && taxRate >= 0 ? taxRate : 18,
    supplierStateCode: ctx.stateCode,
    placeOfSupplyStateCode: buyerStateCode
  });
  const party = await upsertParty(ctx, buyerName, "CUSTOMER", buyerGstin, buyerStateCode);
  const invoice = await prisma.invoice.create({
    data: {
      workspaceId: ctx.workspaceId,
      businessId: ctx.businessId,
      partyId: party.id,
      documentId,
      status: "ISSUED",
      invoiceNumber,
      invoiceDate: new Date(invoiceDate),
      sellerGstin: ctx.gstin,
      buyerGstin,
      sellerStateCode: ctx.stateCode,
      buyerStateCode,
      placeOfSupply: buyerStateCode,
      taxableValue,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      total: tax.invoiceValue,
      issuedAt: new Date(),
      createdById: ctx.userId
    }
  });
  await prisma.invoiceItem.create({
    data: {
      workspaceId: ctx.workspaceId,
      invoiceId: invoice.id,
      description: data.description || "Uploaded invoice line",
      hsnSac: data.hsnSac || undefined,
      quantity: 1,
      unitPrice: taxableValue,
      taxRate,
      taxableValue,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      total: tax.invoiceValue
    }
  });
  await createTransactionForInvoice(ctx, invoice.id, {
    invoiceDate,
    customerName: buyerName,
    taxableValue,
    cgst: tax.cgst,
    sgst: tax.sgst,
    igst: tax.igst,
    total: tax.invoiceValue
  });
}

async function postBillFromExtraction(ctx: WorkspaceContext, documentId: string, data: Record<string, string>) {
  const billNumber = data.documentNumber || `BILL-${Date.now()}`;
  const billDate = data.documentDate || new Date().toISOString().slice(0, 10);
  const supplierName = data.supplierName || "Uploaded supplier";
  const supplierGstin = data.supplierGstin || undefined;
  const supplierStateCode = supplierGstin?.slice(0, 2) || "27";
  const taxableValue = numberOr(data.taxableValue, numberOr(data.subtotal, numberOr(data.totalAmount, 0) / 1.18));
  const total = numberOr(data.totalAmount, taxableValue);
  const taxRate = taxableValue > 0 ? round(((total - taxableValue) / taxableValue) * 100) : 18;
  const tax = calculateGstTax({
    taxableValue,
    gstRate: Number.isFinite(taxRate) && taxRate >= 0 ? taxRate : 18,
    supplierStateCode,
    placeOfSupplyStateCode: ctx.stateCode
  });
  const party = await upsertParty(ctx, supplierName, "SUPPLIER", supplierGstin, supplierStateCode);
  const bill = await prisma.bill.create({
    data: {
      workspaceId: ctx.workspaceId,
      businessId: ctx.businessId,
      partyId: party.id,
      documentId,
      status: "ISSUED",
      billNumber,
      billDate: new Date(billDate),
      sellerGstin: supplierGstin,
      buyerGstin: ctx.gstin,
      placeOfSupply: ctx.stateCode,
      taxableValue,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      total: tax.invoiceValue,
      itcEligible: true,
      createdById: ctx.userId
    }
  });
  await prisma.billItem.create({
    data: {
      workspaceId: ctx.workspaceId,
      billId: bill.id,
      description: data.description || "Uploaded bill line",
      hsnSac: data.hsnSac || undefined,
      quantity: 1,
      unitPrice: taxableValue,
      taxRate,
      taxableValue,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      total: tax.invoiceValue
    }
  });
  await createTransactionForBill(ctx, bill.id, {
    billDate,
    supplierName,
    categoryAccountCode: "5000",
    taxableValue,
    cgst: tax.cgst,
    sgst: tax.sgst,
    igst: tax.igst,
    total: tax.invoiceValue,
    itcEligible: true
  });
}

async function postGenericTransaction(ctx: WorkspaceContext, documentId: string, data: Record<string, string>) {
  const amount = numberOr(data.totalAmount, 0);
  await prisma.transaction.create({
    data: {
      workspaceId: ctx.workspaceId,
      businessId: ctx.businessId,
      sourceDocumentId: documentId,
      kind: amount >= 0 ? "RECEIPT" : "PAYMENT",
      status: "POSTED",
      transactionDate: new Date(data.documentDate || new Date()),
      description: data.description || data.supplierName || data.buyerName || "Uploaded document",
      amount,
      category: "uncategorized",
      postedAt: new Date(),
      createdById: ctx.userId
    }
  });
}

async function postBankStatementFromExtraction(ctx: WorkspaceContext, documentId: string, metadata: Prisma.JsonValue | null, data: Record<string, string>) {
  const textSample = metadata && typeof metadata === "object" && !Array.isArray(metadata) && "textSample" in metadata
    ? String(metadata.textSample ?? "")
    : "";
  const parsedTransactions = parseBankTransactions(textSample);
  const reviewedTransactions = parsedTransactions.length > 0 ? parsedTransactions : parseReviewedBankTransactions(data.transactionsJson);
  const account = await prisma.bankAccount.upsert({
    where: { id: `${ctx.businessId}-primary-bank` },
    update: {},
    create: {
      id: `${ctx.businessId}-primary-bank`,
      workspaceId: ctx.workspaceId,
      businessId: ctx.businessId,
      bankName: data.bankName || "Manual bank statement",
      accountHolder: data.accountHolder || "Niyati Studio",
      accountNumberMasked: data.accountNumberMasked || "XXXX",
      currency: "INR",
      createdById: ctx.userId
    }
  });

  for (const item of reviewedTransactions) {
    const bankTransaction = await prisma.bankTransaction.create({
      data: {
        workspaceId: ctx.workspaceId,
        bankAccountId: account.id,
        transactionDate: new Date(item.date),
        description: item.description,
        debit: item.debit || undefined,
        credit: item.credit || undefined,
        balance: item.balance,
        reference: item.reference,
        suggestedCategory: item.category,
        reviewed: true,
        createdById: ctx.userId
      }
    });
    const amount = round((item.credit ?? 0) - (item.debit ?? 0));
    await prisma.transaction.create({
      data: {
        workspaceId: ctx.workspaceId,
        businessId: ctx.businessId,
        sourceDocumentId: documentId,
        bankTransactionId: bankTransaction.id,
        kind: amount >= 0 ? "RECEIPT" : "PAYMENT",
        status: "POSTED",
        transactionDate: new Date(item.date),
        description: item.description,
        amount,
        gstTreatment: "BANK_IMPORT",
        category: item.category,
        postedAt: new Date(),
        createdById: ctx.userId
      }
    });
  }

  if (reviewedTransactions.length === 0) {
    await postGenericTransaction(ctx, documentId, {
      ...data,
      totalAmount: data.totalAmount || "0",
      description: data.description || "Bank statement imported for review"
    });
  }
}

async function createTransactionForInvoice(ctx: Pick<WorkspaceContext, "workspaceId" | "businessId" | "userId">, invoiceId: string, input: {
  invoiceDate: string;
  customerName: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}) {
  const posting = createInvoicePosting({ id: invoiceId, ...input });
  await prisma.transaction.create({
    data: {
      workspaceId: ctx.workspaceId,
      businessId: ctx.businessId,
      invoiceId,
      kind: "SALE",
      status: "POSTED",
      transactionDate: new Date(input.invoiceDate),
      description: posting.description,
      amount: input.total,
      gstTreatment: input.igst > 0 ? "IGST" : "CGST_SGST",
      category: "sales",
      postedAt: new Date(),
      createdById: ctx.userId
    }
  });
}

async function createTransactionForBill(ctx: Pick<WorkspaceContext, "workspaceId" | "businessId" | "userId">, billId: string, input: {
  billDate: string;
  supplierName: string;
  categoryAccountCode: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  itcEligible: boolean;
}) {
  const posting = createBillPosting({ id: billId, ...input });
  await prisma.transaction.create({
    data: {
      workspaceId: ctx.workspaceId,
      businessId: ctx.businessId,
      billId,
      kind: "PURCHASE",
      status: "POSTED",
      transactionDate: new Date(input.billDate),
      description: posting.description,
      amount: -input.total,
      gstTreatment: input.itcEligible ? "ITC_ELIGIBLE" : "NO_ITC",
      category: "software",
      postedAt: new Date(),
      createdById: ctx.userId
    }
  });
}

async function upsertParty(ctx: Pick<WorkspaceContext, "workspaceId" | "userId">, name: string, type: "CUSTOMER" | "SUPPLIER", gstin?: string, stateCode?: string) {
  let party = await prisma.party.findFirst({ where: { workspaceId: ctx.workspaceId, displayName: name } });
  party ??= await prisma.party.create({
    data: {
      workspaceId: ctx.workspaceId,
      type,
      displayName: name,
      legalName: name,
      createdById: ctx.userId
    }
  });

  if (gstin && stateCode) {
    await prisma.partyGstin.upsert({
      where: { workspaceId_gstin_partyId: { workspaceId: ctx.workspaceId, gstin, partyId: party.id } },
      update: {},
      create: {
        workspaceId: ctx.workspaceId,
        partyId: party.id,
        gstin,
        stateCode,
        legalName: name,
        createdById: ctx.userId
      }
    });
  }

  return party;
}

async function ensureCurrentGstReturnPeriod(ctx: WorkspaceContext) {
  return prisma.gstReturnPeriod.upsert({
    where: {
      workspaceId_gstRegistrationId_periodStart_periodEnd: {
        workspaceId: ctx.workspaceId,
        gstRegistrationId: ctx.gstRegistrationId,
        periodStart: new Date("2026-04-01"),
        periodEnd: new Date("2026-04-30")
      }
    },
    update: {},
    create: {
      workspaceId: ctx.workspaceId,
      gstRegistrationId: ctx.gstRegistrationId,
      periodStart: new Date("2026-04-01"),
      periodEnd: new Date("2026-04-30"),
      month: 4,
      financialYear: "FY2026-27",
      filingFrequency: "MONTHLY",
      status: "IN_REVIEW",
      createdById: ctx.userId
    }
  });
}

async function audit(ctx: WorkspaceContext, action: string, entityType: string, entityId: string, before?: unknown, after?: unknown) {
  await prisma.auditEvent.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action,
      entityType,
      entityId,
      before: before as Prisma.InputJsonValue | undefined,
      after: after as Prisma.InputJsonValue | undefined
    }
  });
}

async function extractAndPersistDocument(
  ctx: WorkspaceContext,
  document: {
    id: string;
    originalFilename: string;
    mimeType: string;
    metadata: Prisma.JsonValue | null;
  },
  bytes: Uint8Array,
  mode: "initial" | "rerun"
) {
  const content = await readDocumentContent(ctx, document.originalFilename, document.mimeType, bytes);
  const classification = classifyDocumentStub({
    fileName: document.originalFilename,
    contentType: document.mimeType,
    textSample: content.textSample
  });
  const documentType = mapClassificationToDocumentType(classification.kind);
  const extractionResult = await buildExtractionResult(
    ctx,
    document.originalFilename,
    content.textSample,
    classification
  );

  await prisma.documentPage.deleteMany({
    where: { workspaceId: ctx.workspaceId, documentId: document.id }
  });
  if (content.pages.length > 0) {
    await prisma.documentPage.createMany({
      data: content.pages.slice(0, 50).map((page) => ({
        workspaceId: ctx.workspaceId,
        documentId: document.id,
        pageNumber: page.pageNumber,
        textContent: page.text.slice(0, 100_000)
      }))
    });
  }

  const extractionRow = await prisma.documentExtraction.create({
    data: {
      workspaceId: ctx.workspaceId,
      documentId: document.id,
      aiRunId: extractionResult.aiRunId,
      status: "NEEDS_REVIEW",
      documentType,
      confidence: extractionResult.confidence,
      rawOutput: fieldJson(extractionResult.rawOutput ?? extractionResult.fields),
      normalizedData: fieldJson(extractionResult.fields),
      validation: fieldJson(extractionResult.validation),
      createdById: ctx.userId
    }
  });

  await Promise.all(
    Object.entries(extractionResult.fields).map(([fieldPath, value]) =>
      prisma.documentExtractionField.create({
        data: {
          workspaceId: ctx.workspaceId,
          extractionId: extractionRow.id,
          fieldPath,
          value: fieldJson(value),
          confidence:
            extractionResult.source === "openai"
              ? Math.max(fieldConfidence(fieldPath, value), 0.78)
              : fieldConfidence(fieldPath, value),
          source: fieldJson({
            note: `${extractionResult.source} ${mode === "rerun" ? "re-parse" : "first-pass"} extraction`,
            ocrProvider: content.provider,
            ocrModel: content.model,
            rawText: content.textSample.slice(0, 500)
          }),
          validationStatus: extractionFieldStatus(fieldPath, value),
          validationErrors: extractionFieldErrors(fieldPath, value)
        }
      })
    )
  );

  await prisma.document.update({
    where: { id: document.id },
    data: {
      status: "NEEDS_REVIEW",
      type: documentType,
      currentExtractionId: extractionRow.id,
      metadata: fieldJson({
        ...metadataObject(document.metadata),
        textSample: content.textSample.slice(0, 20_000),
        classification,
        extractionSource: extractionResult.source,
        extractionMode: mode,
        ocr: {
          provider: content.provider,
          model: content.model,
          pageCount: content.pages.length,
          warnings: content.warnings,
          textScore: documentTextScore(content.textSample)
        }
      })
    }
  });

  return extractionRow;
}

async function readDocumentContent(
  ctx: WorkspaceContext,
  fileName: string,
  mimeType: string,
  bytes: Uint8Array
): Promise<DocumentContentResult> {
  const contentType = mimeType.toLowerCase();
  const lowerName = fileName.toLowerCase();
  const warnings: string[] = [];

  if (
    contentType.startsWith("text/") ||
    contentType.includes("csv") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".csv")
  ) {
    const text = new TextDecoder().decode(bytes).slice(0, 80_000);
    return {
      textSample: text,
      pages: [{ pageNumber: 1, text, confidence: 1 }],
      provider: "native_text",
      warnings
    };
  }

  if (contentType === "application/pdf" || lowerName.endsWith(".pdf")) {
    let nativeText = "";
    try {
      nativeText = await extractPdfNativeText(bytes);
    } catch (error) {
      warnings.push(`Local PDF text extraction failed: ${errorMessage(error)}`);
    }

    const openAiAvailability = getOpenAiAvailability();
    let renderedImages: OcrImageInput[] = [];
    if (documentTextScore(nativeText) < 1_000 || openAiAvailability.available) {
      try {
        renderedImages = await renderPdfPagesToImages(bytes, 3);
      } catch (error) {
        warnings.push(`PDF page rasterization failed: ${errorMessage(error)}`);
      }
    }

    let vision: DocumentContentResult | null = null;
    if (openAiAvailability.available) {
      try {
        if (renderedImages.length > 0) {
          vision = await runOpenAiVisionOcr(ctx, fileName, renderedImages);
        } else {
          warnings.push("PDF rasterization did not produce preview pages for OCR.");
        }
      } catch (error) {
        warnings.push(`OpenAI vision OCR failed: ${errorMessage(error)}`);
      }
    } else {
      warnings.push(openAiAvailability.reason ?? "OpenAI vision OCR is not configured; scanned PDFs may need manual correction.");
    }

    const nativePages = splitPdfTextPages(nativeText);
    const nativeResult: DocumentContentResult = {
      textSample: nativeText.trim(),
      pages: nativePages,
      provider: "pdftotext",
      warnings
    };

    let localOcr: DocumentContentResult | null = null;
    if (renderedImages.length > 0) {
      try {
        localOcr = await runLocalTesseractOcr(fileName, renderedImages);
      } catch (error) {
        warnings.push(`Local Tesseract OCR failed: ${errorMessage(error)}`);
      }
    }

    const best = chooseBestDocumentContent(nativeResult, vision, localOcr);
    if (best.textSample.trim().length > 0) {
      return { ...best, warnings: [...warnings, ...best.warnings] };
    }
  }

  if (contentType.startsWith("image/") || /\.(png|jpe?g|webp|gif|tiff?)$/i.test(fileName)) {
    const imageInput = [
      {
        pageNumber: 1,
        mimeType: mimeType || guessImageMimeType(fileName),
        base64: Buffer.from(bytes).toString("base64")
      }
    ];
    const openAiAvailability = getOpenAiAvailability();
    let vision: DocumentContentResult | null = null;
    let localOcr: DocumentContentResult | null = null;

    try {
      localOcr = await runLocalTesseractOcr(fileName, imageInput);
    } catch (error) {
      warnings.push(`Local Tesseract OCR failed: ${errorMessage(error)}`);
    }

    if (openAiAvailability.available) {
      try {
        vision = await runOpenAiVisionOcr(ctx, fileName, imageInput);
      } catch (error) {
        warnings.push(`OpenAI vision OCR failed: ${errorMessage(error)}`);
      }
    } else {
      warnings.push(openAiAvailability.reason ?? "OpenAI vision OCR is not configured for image documents.");
    }

    const best = chooseBestDocumentContent(vision, localOcr);
    if (best.textSample.trim().length > 0) {
      return { ...best, warnings: [...warnings, ...best.warnings] };
    }
  }

  return {
    textSample: `${fileName}\n\nOCR text was unavailable. Please re-run extraction after configuring OCR or correct fields manually.`,
    pages: [],
    provider: "filename_fallback",
    warnings
  };
}

async function extractPdfNativeText(bytes: Uint8Array) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ledgerai-pdf-"));
  const inputPath = path.join(tempDir, "input.pdf");

  try {
    await writeFile(inputPath, bytes);
    const { stdout } = await execFile("pdftotext", ["-layout", "-enc", "UTF-8", inputPath, "-"], {
      encoding: "utf8",
      maxBuffer: 12 * 1024 * 1024
    });
    return stdout.slice(0, 120_000);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function renderPdfPagesToImages(bytes: Uint8Array, maxPages: number): Promise<OcrImageInput[]> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ledgerai-pdf-ocr-"));
  const inputPath = path.join(tempDir, "input.pdf");
  const outputPrefix = path.join(tempDir, "page");

  try {
    await writeFile(inputPath, bytes);
    await execFile(
      "pdftoppm",
      ["-png", "-r", "300", "-f", "1", "-l", String(maxPages), inputPath, outputPrefix],
      { maxBuffer: 24 * 1024 * 1024 }
    );
    const files = (await readdir(tempDir))
      .filter((file) => /^page-\d+\.(?:png|jpe?g)$/i.test(file))
      .sort((a, b) => pageNumberFromImage(a) - pageNumberFromImage(b));

    return Promise.all(
      files.map(async (file) => ({
        pageNumber: pageNumberFromImage(file),
        mimeType: file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
        base64: (await readFile(path.join(tempDir, file))).toString("base64")
      }))
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function runOpenAiVisionOcr(
  ctx: WorkspaceContext,
  fileName: string,
  images: OcrImageInput[]
): Promise<DocumentContentResult> {
  const env = getServerEnv();
  const baseUrl = (env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = env.OPENAI_DEFAULT_MODEL;
  const aiRun = await prisma.aiRun.create({
    data: {
      workspaceId: ctx.workspaceId,
      provider: "openai",
      model,
      purpose: "document_ocr",
      status: "RUNNING",
      startedAt: new Date(),
      input: fieldJson({
        fileName,
        pageImages: images.map((image) => ({
          pageNumber: image.pageNumber,
          mimeType: image.mimeType,
          base64Length: image.base64.length
        }))
      }),
      createdById: ctx.userId
    }
  });

  try {
    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY ?? ""}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "You are a production OCR engine for Indian accounting documents.",
                  "Transcribe all visible accounting text exactly. Preserve GSTIN, PAN, invoice numbers, dates, HSN/SAC, line items, tax amounts, totals, bank references, and table row order.",
                  "Do not infer values that are not visible. Mark uncertain characters as [?] instead of guessing.",
                  "Return JSON only in this exact shape: {\"pages\":[{\"pageNumber\":1,\"text\":\"visible text\",\"confidence\":0.0}],\"summary\":\"short OCR quality note\"}.",
                  `File name: ${fileName}`
                ].join("\n")
              },
              ...images.map((image) => ({
                type: "input_image",
                image_url: `data:${image.mimeType};base64,${image.base64}`,
                detail: "high"
              }))
            ]
          }
        ]
      })
    });
    const payload = (await response.json().catch(() => ({}))) as OpenAiResponsesPayload;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `OpenAI OCR request failed with ${response.status}`);
    }

    const rawText = extractOpenAiResponseText(payload);
    const parsed = safeJsonParse<VisionOcrResponse>(rawText, { maxRepairAttempts: 2 });
    if (!parsed.ok) {
      throw new Error(`OpenAI OCR response was not valid JSON: ${parsed.error}`);
    }

    const pages = (parsed.data.pages ?? [])
      .map((page, index) => ({
        pageNumber: Number(page.pageNumber ?? images[index]?.pageNumber ?? index + 1),
        text: String(page.text ?? "").trim(),
        confidence: clampConfidence(page.confidence)
      }))
      .filter((page) => page.text.length > 0);
    const textSample = pages.map((page) => `--- Page ${page.pageNumber} ---\n${page.text}`).join("\n\n").slice(0, 120_000);

    await prisma.aiRun.update({
      where: { id: aiRun.id },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
        output: fieldJson({
          pageCount: pages.length,
          textLength: textSample.length,
          summary: parsed.data.summary,
          parseMetadata: parsed.metadata
        }),
        tokensIn: payload.usage?.input_tokens,
        tokensOut: payload.usage?.output_tokens
      }
    });

    return {
      textSample,
      pages,
      provider: "openai_vision",
      model,
      warnings: parsed.data.summary ? [parsed.data.summary] : [],
      rawOutput: rawText
    };
  } catch (error) {
    await prisma.aiRun.update({
      where: { id: aiRun.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: errorMessage(error)
      }
    });
    throw error;
  }
}

async function runLocalTesseractOcr(
  fileName: string,
  images: OcrImageInput[]
): Promise<DocumentContentResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ledgerai-tesseract-"));
  try {
    const imagePaths = [];
    for (const image of images) {
      const extension = image.mimeType.includes("png") ? "png" : "jpg";
      const imagePath = path.join(tempDir, `page-${image.pageNumber}.${extension}`);
      await writeFile(imagePath, Buffer.from(image.base64, "base64"));
      imagePaths.push(imagePath);
    }

    const scriptPath = path.join(process.cwd(), "scripts", "tesseract-ocr.mjs");
    const { stdout } = await execFile(process.execPath, [scriptPath, ...imagePaths], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024
    });
    const parsed = safeJsonParse<{
      pages?: Array<{ pageNumber?: number; text?: string; confidence?: number }>;
    }>(stdout, { maxRepairAttempts: 1 });
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const usablePages = (parsed.data.pages ?? [])
      .map((page, index) => ({
        pageNumber: Number(page.pageNumber ?? images[index]?.pageNumber ?? index + 1),
        text: String(page.text ?? "").trim(),
        confidence: clampConfidence(page.confidence)
      }))
      .filter((page) => page.text.length > 0);
    const textSample = usablePages
      .map((page) => `--- Page ${page.pageNumber} ---\n${page.text}`)
      .join("\n\n")
      .slice(0, 120_000);

    return {
      textSample,
      pages: usablePages,
      provider: "tesseract_local",
      model: "tesseract.js-eng",
      warnings: [`Local OCR completed for ${fileName}; review low-confidence fields before posting.`]
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function getOpenAiAvailability(): OpenAiAvailability {
  const env = getServerEnv();
  if (env.AI_PROVIDER !== "openai") return { available: false, reason: "OpenAI OCR is disabled by AI_PROVIDER." };
  if (!env.OPENAI_API_KEY) return { available: false, reason: "OpenAI OCR is not configured." };
  const baseUrl = (env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  if (baseUrl === "https://api.openai.com/v1" && !/^sk-(?:proj-)?[A-Za-z0-9_-]+$/.test(env.OPENAI_API_KEY)) {
    return { available: false, reason: "OpenAI OCR key is configured but is not a valid OpenAI API key format; using local OCR." };
  }
  return { available: true };
}

function chooseBestDocumentContent(...candidates: Array<DocumentContentResult | null>): DocumentContentResult {
  const usable = candidates.filter((candidate): candidate is DocumentContentResult => Boolean(candidate));
  const vision = usable.find((candidate) => candidate.provider === "openai_vision");
  const bestByScore = usable.sort((left, right) => documentTextScore(right.textSample) - documentTextScore(left.textSample))[0];
  if (vision && bestByScore && documentTextScore(vision.textSample) >= documentTextScore(bestByScore.textSample) * 0.75) {
    return vision;
  }
  return bestByScore ?? {
    textSample: "",
    pages: [],
    provider: "filename_fallback",
    warnings: ["No OCR candidate was available."]
  };
}

function documentTextScore(text: string) {
  const normalized = text.trim();
  if (!normalized) return 0;
  const lower = normalized.toLowerCase();
  const keywordHits = [
    "tax invoice",
    "invoice",
    "invoice number",
    "bill to",
    "subtotal",
    "due date",
    "payment terms",
    "description",
    "quantity",
    "unit price",
    "gstin",
    "pan",
    "hsn",
    "sac",
    "cgst",
    "sgst",
    "igst",
    "total",
    "taxable",
    "bank",
    "ifsc",
    "debit",
    "credit",
    "$",
    "usd",
    "cad",
    "gbp"
  ].filter((keyword) => lower.includes(keyword)).length;
  const gstinHits = normalized.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/g)?.length ?? 0;
  const amountHits = normalized.match(/(?:rs\.?|inr|₹)?\s*\d[\d,]*(?:\.\d{1,2})?/gi)?.length ?? 0;
  return Math.min(normalized.length, 20_000) + keywordHits * 300 + gstinHits * 500 + amountHits * 25;
}

function splitPdfTextPages(text: string) {
  return text
    .split("\f")
    .map((pageText, index) => ({
      pageNumber: index + 1,
      text: pageText.trim(),
      confidence: pageText.trim().length > 0 ? 0.9 : 0.2
    }))
    .filter((page) => page.text.length > 0);
}

function pageNumberFromImage(fileName: string) {
  return Number(fileName.match(/-(\d+)\.(?:png|jpe?g)$/i)?.[1] ?? 1);
}

function guessImageMimeType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  return "image/jpeg";
}

function extractOpenAiResponseText(payload: OpenAiResponsesPayload) {
  if (payload.output_text) return payload.output_text;
  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((content): content is string => Boolean(content))
    .join("\n")
    .trim();
  if (!text) throw new Error("OpenAI response did not include OCR text.");
  return text;
}

function clampConfidence(value: unknown) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return undefined;
  return Math.max(0, Math.min(1, confidence));
}

function metadataObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function errorMessage(error: unknown) {
  return redactSensitiveText(error instanceof Error ? error.message : String(error));
}

function redactSensitiveText(value: string) {
  return value
    .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/g, "[redacted-api-key]")
    .replace(/\bv1-[A-Za-z0-9_*.-]{8,}\b/g, "[redacted-api-key]");
}

async function buildExtractionResult(
  ctx: WorkspaceContext,
  fileName: string,
  textSample: string,
  classification: DocumentClassificationResult
): Promise<ExtractionBuildResult> {
  const heuristicFields = buildHeuristicExtraction(fileName, textSample, classification);
  const shouldUseOpenAi = false;

  if (!shouldUseOpenAi) {
    return {
      fields: heuristicFields,
      source: "heuristic",
      confidence: classification.confidence,
      validation: { status: "needs_review", issues: [] },
      rawOutput: heuristicFields
    };
  }

  const env = getServerEnv();
  const aiRun = await prisma.aiRun.create({
    data: {
      workspaceId: ctx.workspaceId,
      provider: "openai",
      model: env.OPENAI_DEFAULT_MODEL,
      purpose: "document_extraction",
      status: "RUNNING",
      startedAt: new Date(),
      input: fieldJson({
        fileName,
        documentKind: classification.kind,
        textLength: textSample.length
      }),
      createdById: ctx.userId
    }
  });

  try {
    const provider = new OpenAiExtractionProvider({
      apiKey: env.OPENAI_API_KEY ?? "",
      model: env.OPENAI_DEFAULT_MODEL,
      baseUrl: env.OPENAI_BASE_URL,
      timeoutMs: 45_000
    });
    const documentKind = classification.kind === "bank_statement" ? "bank_statement" : classification.kind === "bill" ? "bill" : classification.kind === "receipt" ? "receipt" : "invoice";
    const schema = documentKind === "bank_statement" ? bankStatementExtractionSchema : invoiceBillReceiptExtractionSchema;
    const result = await provider.extract<InvoiceBillReceiptExtraction | BankStatementExtraction>({
      documentKind,
      documentText: textSample,
      schema: schema as any,
      prompt: renderExtractionPrompt(documentKind),
      parse: { maxRepairAttempts: 1 },
      metadata: { fileName }
    });
    const fields = documentKind === "bank_statement"
      ? flattenBankStatementExtraction(result.data as BankStatementExtraction)
      : flattenCommercialExtraction(result.data as InvoiceBillReceiptExtraction, heuristicFields);
    const validation = documentKind === "bank_statement"
      ? { status: "needs_review", issues: [] }
      : validateExtraction(result.data, {
          criticalFields: ["documentType", "documentNumber", "documentDate", "totalAmount"],
          gstinFields: ["supplierGstin", "buyerGstin"]
        });

    await prisma.aiRun.update({
      where: { id: aiRun.id },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
        output: fieldJson({ fields, metadata: result.metadata }),
        tokensIn: result.usage?.inputTokens,
        tokensOut: result.usage?.outputTokens
      }
    });

    return {
      fields: { ...heuristicFields, ...fields },
      source: "openai",
      confidence: 0.86,
      validation,
      aiRunId: aiRun.id,
      rawOutput: result.rawOutput
    };
  } catch (error) {
    await prisma.aiRun.update({
      where: { id: aiRun.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: errorMessage(error),
        output: fieldJson({ fallback: "heuristic" })
      }
    });

    return {
      fields: heuristicFields,
      source: "heuristic",
      confidence: classification.confidence,
      validation: { status: "needs_review", issues: [{ code: "ai_fallback", message: "AI extraction failed; heuristic extraction used." }] },
      aiRunId: aiRun.id,
      rawOutput: heuristicFields
    };
  }
}

function buildHeuristicExtraction(fileName: string, text: string, classification: DocumentClassificationResult): Record<string, FieldValue> {
  if (classification.kind === "bank_statement") {
    const transactions = parseBankTransactions(text);
    return {
      documentType: "bank_statement",
      bankName: findLabelledText(text, ["bank", "bank name"]) ?? "Manual bank statement",
      accountHolder: findLabelledText(text, ["account holder", "name"]) ?? "Niyati Studio",
      accountNumberMasked: maskAccountNumber(findLabelledText(text, ["account number", "account no"]) ?? ""),
      documentDate: transactions[0]?.date ?? new Date().toISOString().slice(0, 10),
      description: `${transactions.length} bank transactions ready for review`,
      totalAmount: transactions.reduce((total, item) => total + (item.credit ?? 0) - (item.debit ?? 0), 0),
      transactionsJson: JSON.stringify(transactions)
    };
  }
  const kind = inferCommercialDocumentKind(text, classification);
  const currency = findCurrency(text);
  const subtotal = findLabelledAmount(text, ["subtotal", "sub total"]);
  const totalTax = findLabelledAmount(text, ["total tax", "tax"]);
  const amount = findAmount(text);
  const taxable = subtotal ?? (amount !== null && totalTax !== null ? round(amount - totalTax) : amount);
  const supplierGstin = findGstin(text, ["supplier gstin", "seller gstin", "gstin"], true);
  const buyerGstin = findGstin(text, ["buyer gstin", "recipient gstin", "customer gstin"], false);

  return {
    documentType: kind,
    documentNumber: findInvoiceNumber(text),
    documentDate: findDate(text),
    supplierName: findSupplierNameFromFirstBlock(text) ?? findSupplierName(text),
    supplierGstin,
    buyerName: findBuyerName(text),
    buyerGstin,
    placeOfSupply: supplierGstin?.slice(0, 2) ?? buyerGstin?.slice(0, 2) ?? null,
    currency,
    description: findFirstLineItemDescription(text) ?? findDocumentDescription(text),
    hsnSac: findHsnSac(text),
    taxableValue: taxable,
    totalAmount: amount
  };
}

function flattenCommercialExtraction(
  extraction: InvoiceBillReceiptExtraction,
  fallback: Record<string, FieldValue>
): Record<string, FieldValue> {
  const firstLine = extraction.lineItems[0];
  const extractedDocumentType = extractedValue(extraction.documentType);
  const documentType =
    fallback.documentType === "invoice" && extractedDocumentType === "receipt"
      ? "invoice"
      : extractedDocumentType ?? fallback.documentType ?? "invoice";
  const totalAmount = extractedValue(extraction.totalAmount) ?? fallback.totalAmount ?? 0;
  const taxableValue = extractedValue(extraction.taxableValue) ?? extractedValue(extraction.subtotal) ?? fallback.taxableValue ?? totalAmount;

  return {
    documentType,
    documentNumber: fieldOrNull(extractedValue(extraction.documentNumber) ?? fallback.documentNumber),
    documentDate: fieldOrNull(extractedValue(extraction.documentDate) ?? fallback.documentDate),
    supplierName: fieldOrNull(extractedValue(extraction.supplierName) ?? fallback.supplierName),
    supplierGstin: fieldOrNull(extractedValue(extraction.supplierGstin) ?? fallback.supplierGstin),
    buyerName: fieldOrNull(extractedValue(extraction.buyerName) ?? fallback.buyerName),
    buyerGstin: fieldOrNull(extractedValue(extraction.buyerGstin) ?? fallback.buyerGstin),
    placeOfSupply: fieldOrNull(extractedValue(extraction.placeOfSupply) ?? fallback.placeOfSupply),
    description: fieldOrNull(extractedValue(firstLine?.description) ?? fallback.description),
    hsnSac: fieldOrNull(extractedValue(firstLine?.hsnSac) ?? fallback.hsnSac),
    taxableValue: typeof taxableValue === "number" ? taxableValue : numberOr(String(taxableValue), Number(fallback.taxableValue ?? 0)),
    totalAmount: typeof totalAmount === "number" ? totalAmount : numberOr(String(totalAmount), Number(fallback.totalAmount ?? 0))
  };
}

function flattenBankStatementExtraction(extraction: BankStatementExtraction): Record<string, FieldValue> {
  const transactions = extraction.transactions.map((transaction) => {
    const amount = extractedValue(transaction.amount) ?? 0;
    const type = extractedValue(transaction.type);
    return {
      date: extractedValue(transaction.transactionDate) ?? new Date().toISOString().slice(0, 10),
      description: extractedValue(transaction.description) ?? "Bank transaction",
      debit: type === "debit" ? amount : 0,
      credit: type === "credit" ? amount : 0,
      balance: extractedValue(transaction.balanceAfterTransaction) ?? undefined,
      reference: extractedValue(transaction.reference) ?? undefined,
      category: extractedValue(transaction.categoryHint) ?? suggestCategory(extractedValue(transaction.description) ?? "")
    };
  });
  return {
    documentType: "bank_statement",
    bankName: extractedValue(extraction.bankName) ?? "Manual bank statement",
    accountHolder: extractedValue(extraction.accountHolderName) ?? "Niyati Studio",
    accountNumberMasked: maskAccountNumber(extractedValue(extraction.accountNumber) ?? ""),
    documentDate: extractedValue(extraction.statementPeriodEnd) ?? new Date().toISOString().slice(0, 10),
    description: `${transactions.length} bank transactions ready for review`,
    totalAmount: transactions.reduce((total, item) => total + Number(item.credit ?? 0) - Number(item.debit ?? 0), 0),
    transactionsJson: JSON.stringify(transactions)
  };
}

function getLocalStorage() {
  const rootDir = path.join(process.cwd(), "uploads", "private");
  void mkdir(rootDir, { recursive: true });
  return new LocalPrivateStorageAdapter({ rootDir });
}

function mapClassificationToDocumentType(kind: string) {
  if (kind === "invoice") return "SALES_INVOICE" as const;
  if (kind === "bill") return "PURCHASE_BILL" as const;
  if (kind === "receipt") return "RECEIPT" as const;
  if (kind === "bank_statement") return "BANK_STATEMENT" as const;
  return "UNKNOWN" as const;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

function fieldJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === undefined) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function fieldConfidence(field: string, value: unknown) {
  if (field === "hsnSac" && !value) return 0.25;
  if (value === "" || value === null || value === undefined) return 0.25;
  if (field === "documentType" || field === "documentNumber" || field === "totalAmount") return 0.9;
  return 0.82;
}

function extractionFieldStatus(fieldPath: string, value: unknown) {
  if (value === "" || value === null || value === undefined) return "NEEDS_REVIEW" as const;
  if (fieldPath === "hsnSac" || fieldPath.endsWith("Gstin") || fieldPath === "placeOfSupply") return "NEEDS_REVIEW" as const;
  return "VALID" as const;
}

function extractionFieldErrors(fieldPath: string, value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return ["No reliable value was found in OCR evidence; confirm manually."];
  }
  if (fieldPath === "hsnSac") return ["Confirm HSN/SAC before GST export when applicable."];
  if (fieldPath.endsWith("Gstin")) return ["Confirm GSTIN only if this is an India GST document."];
  if (fieldPath === "placeOfSupply") return ["Confirm place of supply only if this is a GST document."];
  return [];
}

function findAmount(text: string): number | null {
  const amountPattern = "([0-9][0-9,]*(?:\\.\\d{1,2})?)";
  const labelled = new RegExp(
    `(?:grand\\s+total|invoice\\s+value|total\\s+amount|amount\\s+payable|balance\\s+due|total|amount)\\s*[:=-]?\\s*(?:rs\\.?|inr|₹|\\$|usd|cad|gbp|eur|£|€)?\\s*${amountPattern}`,
    "gi"
  );
  const labelledCandidates = Array.from(text.matchAll(labelled), (match) => moneyNumber(match[1]));
  const labelledAmount = lastPlausibleAmount(labelledCandidates);
  if (labelledAmount !== null) return labelledAmount;

  const currency = new RegExp(`(?:rs\\.?|inr|₹|\\$|usd|cad|gbp|eur|£|€)\\s*${amountPattern}`, "gi");
  return lastPlausibleAmount(Array.from(text.matchAll(currency), (match) => moneyNumber(match[1])));
}

function findLabelledAmount(text: string, labels: string[]): number | null {
  const amountPattern = "([0-9][0-9,]*(?:\\.\\d{1,2})?)";
  for (const label of labels) {
    const pattern = new RegExp(
      `${escapeRegExp(label)}(?:\\s*\\([^)]*\\))?\\s*[:=-]?\\s*(?:rs\\.?|inr|₹|\\$|usd|cad|gbp|eur|£|€)?\\s*${amountPattern}`,
      "i"
    );
    const amount = moneyNumber(text.match(pattern)?.[1]);
    if (amount !== null) return amount;
  }
  return null;
}

function moneyNumber(value: string | undefined): number | null {
  if (!value) return null;
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function lastPlausibleAmount(values: Array<number | null>): number | null {
  const plausible = values.filter((value): value is number => value !== null && value > 0 && value < 100_000_000);
  return plausible.at(-1) ?? null;
}

function findInvoiceNumber(text: string): string | null {
  return (
    text.match(/(?:invoice|bill|receipt|document)\s*(?:no\.?|number|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{1,})/i)?.[1] ??
    text.match(/\b(?:inv|bill|receipt)[-/#:\s]+([A-Z0-9][A-Z0-9/-]{1,})\b/i)?.[1] ??
    null
  );
}

function findDate(text: string): string | null {
  const labelled = text.match(
    /(?:invoice\s+date|bill\s+date|receipt\s+date|document\s+date|date)\s*[:=-]?\s*(\d{1,2}[/-]\d{1,2}[/-](?:20)?\d{2}|20\d{2}-\d{2}-\d{2})/i
  )?.[1];
  const labelledDate = labelled ? parseDateToken(labelled) : null;
  if (labelledDate) return labelledDate;
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  if (iso) return iso;
  return parseDateToken(text.match(/\b(\d{1,2}[/-]\d{1,2}[/-](?:20)?\d{2})\b/)?.[1] ?? "");
}

function inferCommercialDocumentKind(text: string, classification: DocumentClassificationResult) {
  const lower = text.toLowerCase();
  if (lower.includes("invoice number") || lower.includes("tax invoice") || /\binvoice\b/i.test(text)) return "invoice";
  if (classification.kind === "bill") return "bill";
  if (classification.kind === "receipt" && !lower.includes("due on receipt")) return "receipt";
  return "invoice";
}

function findCurrency(text: string): string | null {
  if (/[₹]|(?:\brs\.?\b|\binr\b)/i.test(text)) return "INR";
  if (/\$|\busd\b/i.test(text)) return "USD";
  if (/\bcad\b/i.test(text)) return "CAD";
  if (/£|\bgbp\b/i.test(text)) return "GBP";
  if (/€|\beur\b/i.test(text)) return "EUR";
  return null;
}

function findGstin(text: string, labels: string[], allowUnlabelled: boolean): string | null {
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}\\s*[:=-]?\\s*(\\d{2}[A-Z]{5}\\d{4}[A-Z][A-Z0-9]Z[A-Z0-9])`, "i");
    const match = text.match(pattern)?.[1];
    if (match) return match.toUpperCase();
  }
  return allowUnlabelled
    ? text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/i)?.[0]?.toUpperCase() ?? null
    : null;
}

function findSupplierName(text: string): string | null {
  const beforeInvoiceNumber =
    text.match(/\n\s*([A-Z][^\n]{1,60}?)\s+(?:invoice\s+number|invoice\s+no\.?)/i)?.[1] ??
    text.match(/\n\s*([A-Z][^\n]{1,60}?)\s+\binv\b/i)?.[1];
  const labelled = findLabelledText(text, ["seller", "supplier", "vendor", "from"]);
  const firstBlockName = findSupplierNameFromFirstBlock(text);
  return cleanPartyName(labelled ?? beforeInvoiceNumber ?? firstBlockName);
}

function findSupplierNameFromFirstBlock(text: string): string | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const stopIndex = lines.findIndex((line) => /^bill\s+to\b|^ship\s+to\b|^invoice\s+(number|no)|^description\b/i.test(line));
  const candidates = (stopIndex >= 0 ? lines.slice(0, stopIndex) : lines.slice(0, 8)).filter(
    (line) =>
      !/^(unidoc|pdf library|invoice|phone|email|date|payment|paid|address)\b/i.test(line) &&
      !/@/.test(line) &&
      !/\d/.test(line) &&
      line.length <= 80
  );
  return cleanPartyName(candidates[0]);
}

function findBuyerName(text: string): string | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const billToIndex = lines.findIndex((line) => /^bill\s+to\b|^ship\s+to\b|^buyer\b|^customer\b/i.test(line));
  if (billToIndex >= 0) {
    for (const line of lines.slice(billToIndex + 1, billToIndex + 5)) {
      const cleaned = cleanPartyName(line);
      if (cleaned) return cleaned;
    }
  }
  return cleanPartyName(findLabelledText(text, ["buyer", "customer", "bill to"]));
}

function findFirstLineItemDescription(text: string): string | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headerIndex = lines.findIndex((line) => /description/i.test(line) && /(quantity|qty|unit|amount|price)/i.test(line));
  const candidates = headerIndex >= 0 ? lines.slice(headerIndex + 1, headerIndex + 8) : lines;
  for (const line of candidates) {
    if (/^(subtotal|tax|shipping|total|notes|terms)/i.test(line)) continue;
    const match = line.match(/^(.+?)\s+\d+(?:\.\d+)?\s+[$₹£€]?\d[\d,.]*(?:\.\d{1,2})?\s+[$₹£€]?\d[\d,.]*(?:\.\d{1,2})?$/);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function findDocumentDescription(text: string): string | null {
  if (/\binvoice\b/i.test(text)) return "Uploaded invoice";
  if (/\bbill\b/i.test(text)) return "Uploaded bill";
  if (/\breceipt\b/i.test(text)) return "Uploaded receipt";
  return null;
}

function findHsnSac(text: string): string | null {
  return text.match(/\b(?:hsn|sac|hsn\/sac)\s*[:=-]?\s*([0-9]{4,8})\b/i)?.[1] ?? null;
}

function parseDateToken(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = trimmed.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (iso) return trimmed;
  const parts = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-]((?:20)?\d{2})$/);
  if (!parts) return null;
  const first = Number(parts[1]);
  const second = Number(parts[2]);
  const yearToken = parts[3] ?? "";
  const year = yearToken.length === 2 ? `20${yearToken}` : yearToken;
  const monthFirst = first > 12 ? false : second > 12 ? true : true;
  const month = monthFirst ? first : second;
  const day = monthFirst ? second : first;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function cleanPartyName(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/\b(invoice|bill|receipt|number|no\.?|date|payment terms|due date)\b.*$/i, "")
    .replace(/[:#-]+$/g, "")
    .trim();
  if (cleaned.length < 2) return null;
  if (/^(phone|email|address|date|payment|terms|united|street|city|state|country)\b/i.test(cleaned)) return null;
  return cleaned;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractedValue<T>(field: { value: T | null } | undefined): T | null {
  return field?.value ?? null;
}

function fieldOrNull(value: FieldValue | undefined): FieldValue {
  return value ?? null;
}

function findLabelledText(text: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:=-]\\s*([^\\n\\r,]+)`, "i");
    const match = text.match(pattern)?.[1]?.trim();
    if (match) return match;
  }
  return null;
}

function maskAccountNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "XXXX";
  return `XXXX${digits.slice(-4)}`;
}

type ParsedBankTransaction = {
  date: string;
  description: string;
  debit?: number;
  credit?: number;
  balance?: number;
  reference?: string;
  category: string;
};

function parseBankTransactions(text: string): ParsedBankTransaction[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const transactions: ParsedBankTransaction[] = [];

  for (const line of lines) {
    if (/^(date|txn date|transaction date)/i.test(line)) continue;
    const columns = line.includes("\t") ? line.split("\t") : line.split(",");
    const normalized = columns.map((column) => column.trim().replace(/^"|"$/g, ""));
    const date = findDate(normalized[0] ?? line) ?? findDate(line);
    if (!date) continue;

    const description = normalized[1] || normalized[2] || "Bank transaction";
    const numericColumns = normalized
      .slice(2)
      .map((column) => moneyNumber(column))
      .filter((value): value is number => value !== null);
    const debit = labelledMoney(line, ["debit", "withdrawal", "dr"]) ?? numericColumns[0] ?? 0;
    const credit = labelledMoney(line, ["credit", "deposit", "cr"]) ?? numericColumns[1] ?? 0;
    const balance = labelledMoney(line, ["balance"]) ?? numericColumns.at(-1);
    const category = suggestCategory(description);
    transactions.push({
      date,
      description,
      debit,
      credit,
      balance,
      reference: normalized[5],
      category
    });
  }

  return transactions.slice(0, 300);
}

function parseReviewedBankTransactions(value: string | undefined): ParsedBankTransaction[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as Array<Partial<ParsedBankTransaction>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        date: typeof item.date === "string" ? item.date : new Date().toISOString().slice(0, 10),
        description: typeof item.description === "string" ? item.description : "Bank transaction",
        debit: Number.isFinite(Number(item.debit)) ? Number(item.debit) : 0,
        credit: Number.isFinite(Number(item.credit)) ? Number(item.credit) : 0,
        balance: Number.isFinite(Number(item.balance)) ? Number(item.balance) : undefined,
        reference: typeof item.reference === "string" ? item.reference : undefined,
        category: typeof item.category === "string" ? item.category : "uncategorized"
      }))
      .slice(0, 300);
  } catch {
    return [];
  }
}

function labelledMoney(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*[:=-]\\s*(?:rs\\.?|inr|₹)?\\s*([0-9][0-9,]*(?:\\.\\d{1,2})?)`, "i"))?.[1];
    const value = moneyNumber(match);
    if (value !== null) return value;
  }
  return null;
}

async function recordExport(ctx: WorkspaceContext, kind: string, parameters: Prisma.InputJsonValue) {
  const job = await prisma.exportJob.create({
    data: {
      workspaceId: ctx.workspaceId,
      kind,
      status: "SUCCEEDED",
      parameters,
      createdById: ctx.userId
    }
  });
  await audit(ctx, "export", "export_job", job.id, undefined, { kind, parameters });
}

function toCsv(rows: ExportableRecord[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] ?? {});
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n");
}

function csvCell(value: string | number | boolean | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function regionBasePath(region: "india" | "north-america") {
  return region === "north-america" ? "/na" : "/app";
}

function regionDefaultProjectName(region: "india" | "north-america", ctx: WorkspaceContext) {
  return region === "north-america" ? "Maple & Main Studio" : ctx.workspaceName;
}

async function ensureDefaultProject(ctx: WorkspaceContext, region: "india" | "north-america") {
  const existing = await prisma.reviewTask.findFirst({
    where: { workspaceId: ctx.workspaceId, entityType: PROJECT_ENTITY_TYPE, entityId: ctx.workspaceId }
  });
  if (existing) return existing;

  return prisma.reviewTask.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: regionDefaultProjectName(region, ctx),
      description: "Primary workspace project",
      status: "OPEN",
      entityType: PROJECT_ENTITY_TYPE,
      entityId: ctx.workspaceId,
      createdById: ctx.userId
    }
  });
}

async function findActiveProject(ctx: WorkspaceContext, projectId: string): Promise<ProjectTask | null> {
  return prisma.reviewTask.findFirst({
    where: {
      id: projectId,
      workspaceId: ctx.workspaceId,
      entityType: PROJECT_ENTITY_TYPE,
      status: { not: "CLOSED" }
    },
    select: {
      id: true,
      title: true,
      description: true,
      entityId: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

function isDefaultProject(ctx: WorkspaceContext, project: ProjectTask) {
  return project.entityId === ctx.workspaceId;
}

function projectDocumentWhere(ctx: WorkspaceContext, project: ProjectTask): Prisma.DocumentWhereInput {
  if (isDefaultProject(ctx, project)) return { workspaceId: ctx.workspaceId };
  return {
    workspaceId: ctx.workspaceId,
    metadata: {
      path: ["projectId"],
      equals: project.id
    }
  };
}

async function summarizeProject(ctx: WorkspaceContext, region: "india" | "north-america", project: ProjectTask): Promise<ProjectSummary> {
  const documentWhere = projectDocumentWhere(ctx, project);
  const [fileCount, reviewCount] = await Promise.all([
    prisma.document.count({ where: documentWhere }),
    prisma.document.count({
      where: {
        ...documentWhere,
        status: { in: ["NEEDS_REVIEW", "EXTRACTED"] }
      }
    })
  ]);
  const defaultProject = isDefaultProject(ctx, project);
  const displayName = defaultProject && region === "north-america" && project.title === "Niyati Studio"
    ? "Maple & Main Studio"
    : defaultProject && region === "india" && project.title === "Maple & Main Studio"
      ? ctx.workspaceName
      : project.title;

  return {
    id: project.id,
    name: displayName,
    detail: defaultProject
      ? region === "north-america"
        ? "US EIN 12-3456789 · NY/NJ/CT/SF · TY 2026"
        : `${ctx.gstin} · ${ctx.financialYear}`
      : "Project workspace",
    isDefault: defaultProject,
    fileCount,
    reviewCount,
    updatedAt: project.updatedAt,
    createdAt: project.createdAt
  };
}

function buildProjectOverview({
  project,
  documents,
  docsNeedingReview,
  transactions,
  invoices,
  bills,
  reviewTasks
}: {
  project: ProjectSummary;
  documents: Array<{ originalFilename: string; status: string; type: string; createdAt: Date }>;
  docsNeedingReview: Array<{ originalFilename: string }>;
  transactions: Array<{ description: string; amount: Prisma.Decimal; transactionDate: Date }>;
  invoices: Array<{ invoiceNumber: string; status: string }>;
  bills: Array<{ billNumber: string; status: string }>;
  reviewTasks: Array<{ title: string }>;
}) {
  const latestDocument = documents[0];
  const pendingCount = docsNeedingReview.length + reviewTasks.length;
  const title = documents.length === 0
    ? "Ready for source files"
    : pendingCount > 0
      ? "Review queue is the next step"
      : "Ready to work";
  const materialCount = invoices.length + bills.length;
  const summary = documents.length === 0
    ? `${project.name} does not have source records yet. Upload invoices, bank statements, receipts, or supporting files to build the project context.`
    : `${project.name} has ${documents.length} source record${documents.length === 1 ? "" : "s"}, ${transactions.length} recent transaction${transactions.length === 1 ? "" : "s"}, and ${materialCount} invoice or bill material${materialCount === 1 ? "" : "s"} in scope.`;
  const bullets = [
    pendingCount > 0
      ? `${pendingCount} item${pendingCount === 1 ? "" : "s"} need review before reports and workflows should be treated as final.`
      : "No open review items are blocking this project.",
    latestDocument
      ? `Latest file: ${latestDocument.originalFilename}.`
      : "No files have been uploaded to this project yet.",
    materialCount > 0
      ? `${invoices.length} invoice${invoices.length === 1 ? "" : "s"} and ${bills.length} bill${bills.length === 1 ? "" : "s"} are available as accounting material.`
      : "No invoice or bill material has been created from this project yet."
  ];

  return { title, summary, bullets };
}

function buildAssistantAnswer(input: AssistantAnswerInput) {
  const query = input.query.trim();
  const normalized = query.toLowerCase();
  const currency = input.region === "north-america" ? "USD" : "INR";
  const base = input.region === "north-america" ? "/na" : "/app";
  const reviewDocs = input.documents.filter((document) => document.status === "NEEDS_REVIEW" || document.status === "EXTRACTED");
  const expenseTransactions = input.transactions.filter((transaction) => Number(transaction.amount) < 0);
  const latestDocument = input.documents[0];
  const recentTransaction = input.transactions[0];

  if (!query) {
    return {
      title: "Ask me what to do next",
      message:
        input.project
          ? `This chat is scoped to ${input.project.name}. Upload receipts, bills, invoices, or bank statements here and I will use them as the project context.`
          : "Upload receipts, bills, invoices, or bank statements. I will extract the records, show what needs review, and keep tax/report outputs in draft until you approve them.",
      citations: latestDocument
        ? [{ label: latestDocument.originalFilename, href: `${base}/vault/${latestDocument.id}` }]
        : [],
      nextActions: ["Upload documents", "Review pending records", "Prepare monthly report"]
    };
  }

  if (/(expense|spend|cost|receipt|bill)/.test(normalized)) {
    return {
      title: "Expense status",
      message: `Reviewed expenses are ${formatAssistantMoney(input.money.expenses, currency)}. ${reviewDocs.length} uploaded record${reviewDocs.length === 1 ? "" : "s"} still need review before reports and tax packs update.`,
      citations: [
        ...expenseTransactions.slice(0, 2).map((transaction) => ({
          label: transaction.description,
          href: `${base}/vault#transactions`
        })),
        ...reviewDocs.slice(0, 1).map((document) => ({
          label: document.originalFilename,
          href: `${base}/vault/${document.id}`
        }))
      ],
      nextActions: ["Review expense documents", "Export transactions CSV", "Ask for category breakdown"]
    };
  }

  if (/(tax|gst|sales tax|1040|schedule c|1099|itr|return)/.test(normalized)) {
    const regionalTax = input.region === "north-america" ? "sales-tax, 1099, and Schedule C" : "GST and income-tax";
    return {
      title: "Tax workspace status",
      message: `I can prepare draft ${regionalTax} outputs from reviewed records. Current income is ${formatAssistantMoney(input.money.income, currency)}, expenses are ${formatAssistantMoney(input.money.expenses, currency)}, and ${reviewDocs.length} document${reviewDocs.length === 1 ? "" : "s"} still need review.`,
      citations: [
        { label: input.region === "north-america" ? "Tax workflows" : "GST and tax workflows", href: `${base}/workflows` },
        ...(recentTransaction ? [{ label: recentTransaction.description, href: `${base}/vault#transactions` }] : [])
      ],
      nextActions: [input.region === "north-america" ? "Prepare CPA pack" : "Prepare CA pack", "Review source documents", "Open tax workflow"]
    };
  }

  if (/(invoice|client|customer|paid|receivable)/.test(normalized)) {
    return {
      title: "Invoice and receivable status",
      message: `Open receivables are ${formatAssistantMoney(input.money.receivables, currency)} across issued invoices that are not marked paid or cancelled.`,
      citations: input.invoices.slice(0, 3).map((invoice) => ({
        label: `${invoice.invoiceNumber} · ${invoice.status.toLowerCase()}`,
        href: `${base}/workflows#create-invoice`
      })),
      nextActions: ["Create invoice", "Review receivables", "Export invoice pack"]
    };
  }

  if (/(report|export|cpa|ca|summary|pack)/.test(normalized)) {
    return {
      title: "Report pack status",
      message: `Reports can be generated from approved records now. I recommend reviewing ${reviewDocs.length} pending document${reviewDocs.length === 1 ? "" : "s"} first so the export pack is complete.`,
      citations: [
        { label: "Reports", href: `${base}/reports` }
      ],
      nextActions: ["Generate report pack", "Review pending documents", "Download transactions CSV"]
    };
  }

  return {
    title: "Workspace answer",
    message: `I found ${input.documents.length} recent documents, ${input.transactions.length} recent accounting entries, ${input.suggestions.length} pending AI approval${input.suggestions.length === 1 ? "" : "s"}, and ${input.reviewTasks.length} open task${input.reviewTasks.length === 1 ? "" : "s"}. Ask about expenses, taxes, invoices, reports, or upload more records.`,
    citations: [
      ...(latestDocument ? [{ label: latestDocument.originalFilename, href: `${base}/vault/${latestDocument.id}` }] : []),
      ...(recentTransaction ? [{ label: recentTransaction.description, href: `${base}/vault#transactions` }] : [])
    ],
    nextActions: ["Upload documents", "Review approvals", "Run a workflow"]
  };
}

function formatAssistantMoney(value: number, currency: "INR" | "USD") {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

function enumValue<const T extends readonly string[]>(value: string, allowed: T): T[number] {
  const normalized = value.trim().toUpperCase();
  if (!allowed.includes(normalized)) {
    throw new Error(`Unsupported value: ${value}`);
  }
  return normalized as T[number];
}

function oneOf<const T extends readonly string[]>(value: string, allowed: T): T[number] {
  const normalized = value.trim();
  if (!allowed.includes(normalized)) {
    throw new Error(`Unsupported value: ${value}`);
  }
  return normalized as T[number];
}

function requiredString(formData: FormData, key: string) {
  const value = optionalString(formData, key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function safeReturnPath(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (!/^\/(app|na)(\/|$)/.test(value)) return fallback;
  return value;
}

function revalidateProjectPaths(projectId?: string) {
  revalidatePath("/app/projects");
  revalidatePath("/na/projects");
  revalidatePath("/app/assistant");
  revalidatePath("/na/assistant");
  if (projectId) {
    revalidatePath(`/app/projects/${projectId}`);
    revalidatePath(`/na/projects/${projectId}`);
  }
}

function documentReviewPath(returnTo: string, documentId: string) {
  const normalized = returnTo.replace(/\/$/, "");
  if (normalized.endsWith("/vault") || normalized.endsWith("/inbox")) {
    return `${normalized}/${documentId}`;
  }
  return normalized;
}

function numberOr(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sum(values: Array<Prisma.Decimal | number | null | undefined>) {
  return round(values.reduce<number>((total, value) => total + Number(value ?? 0), 0));
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function groupBy<T, K>(items: T[], key: (item: T) => K) {
  const grouped = new Map<K, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), item]);
  }
  return grouped;
}
