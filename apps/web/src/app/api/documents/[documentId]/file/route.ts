import { NextResponse } from "next/server";
import { getDocumentFileData } from "@/lib/server/workspace";

type DocumentFileRouteProps = {
  params: Promise<{ documentId: string }>;
};

export async function GET(_request: Request, { params }: DocumentFileRouteProps) {
  const { documentId } = await params;
  const data = await getDocumentFileData(documentId);
  if (!data) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(data.bytes), {
    headers: {
      "Content-Type": data.contentType,
      "Content-Disposition": `inline; filename="${safeHeaderFilename(data.document.originalFilename)}"`,
      "Cache-Control": "private, max-age=60"
    }
  });
}

function safeHeaderFilename(fileName: string) {
  return fileName.replace(/["\r\n]/g, "-").slice(0, 120);
}
