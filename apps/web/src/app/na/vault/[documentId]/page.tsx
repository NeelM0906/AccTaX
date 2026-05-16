import { DocumentReview } from "@/components/document-review";

type NorthAmericaDocumentReviewPageProps = {
  params: Promise<{ documentId: string }>;
};

export default function NorthAmericaDocumentReviewPage({ params }: NorthAmericaDocumentReviewPageProps) {
  return <DocumentReview params={params} basePath="/na" />;
}
