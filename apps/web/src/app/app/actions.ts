"use server";

import {
  approveDocument as approveDocumentAction,
  createProject as createProjectAction,
  createDocumentRequest as createDocumentRequestAction,
  createInvoice as createInvoiceAction,
  deleteProject as deleteProjectAction,
  inviteWorkspaceMember as inviteWorkspaceMemberAction,
  queueInvoiceEmail as queueInvoiceEmailAction,
  rejectDocument as rejectDocumentAction,
  renameProject as renameProjectAction,
  rerunDocumentExtraction as rerunDocumentExtractionAction,
  reviewAiSuggestion as reviewAiSuggestionAction,
  saveIntegrationAccount as saveIntegrationAccountAction,
  saveOnboarding as saveOnboardingAction,
  updateGstReturnStatus as updateGstReturnStatusAction,
  uploadDocument as uploadDocumentAction
} from "@/lib/server/workspace";

export async function uploadDocument(formData: FormData) {
  return uploadDocumentAction(formData);
}

export async function approveDocument(formData: FormData) {
  return approveDocumentAction(formData);
}

export async function createProject(formData: FormData) {
  return createProjectAction(formData);
}

export async function renameProject(formData: FormData) {
  return renameProjectAction(formData);
}

export async function deleteProject(formData: FormData) {
  return deleteProjectAction(formData);
}

export async function rerunDocumentExtraction(formData: FormData) {
  return rerunDocumentExtractionAction(formData);
}

export async function rejectDocument(formData: FormData) {
  return rejectDocumentAction(formData);
}

export async function createInvoice(formData: FormData) {
  return createInvoiceAction(formData);
}

export async function saveOnboarding(formData: FormData) {
  return saveOnboardingAction(formData);
}

export async function inviteWorkspaceMember(formData: FormData) {
  return inviteWorkspaceMemberAction(formData);
}

export async function createDocumentRequest(formData: FormData) {
  return createDocumentRequestAction(formData);
}

export async function saveIntegrationAccount(formData: FormData) {
  return saveIntegrationAccountAction(formData);
}

export async function updateGstReturnStatus(formData: FormData) {
  return updateGstReturnStatusAction(formData);
}

export async function queueInvoiceEmail(formData: FormData) {
  return queueInvoiceEmailAction(formData);
}

export async function reviewAiSuggestion(formData: FormData) {
  return reviewAiSuggestionAction(formData);
}
