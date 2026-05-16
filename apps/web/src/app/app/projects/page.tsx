import { ProjectsIndex } from "@/components/project-pages";
import { getProjectsData } from "@/lib/server/workspace";

export default async function ProjectsPage() {
  const data = await getProjectsData("india");
  return <ProjectsIndex data={data} />;
}
