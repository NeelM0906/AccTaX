import { notFound } from "next/navigation";
import { ProjectWorkspace } from "@/components/project-pages";
import { getProjectWorkspaceData } from "@/lib/server/workspace";

type ProjectPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function NorthAmericaProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const data = await getProjectWorkspaceData("north-america", projectId);
  if (!data) notFound();
  return <ProjectWorkspace data={data} />;
}
