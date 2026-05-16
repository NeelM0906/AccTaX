import { DocumentReview } from "@/components/document-review";

type DocumentReviewPageProps = {
  params: Promise<{ documentId: string }>;
};

export default function DocumentReviewPage({ params }: DocumentReviewPageProps) {
  return <DocumentReview params={params} basePath="/app" />;
}
