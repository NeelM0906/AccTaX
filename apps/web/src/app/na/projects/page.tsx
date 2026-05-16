import { ProjectsIndex } from "@/components/project-pages";
import { getProjectsData } from "@/lib/server/workspace";

export default async function NorthAmericaProjectsPage() {
  const data = await getProjectsData("north-america");
  return <ProjectsIndex data={data} />;
}
