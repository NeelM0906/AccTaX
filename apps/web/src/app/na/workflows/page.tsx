import { WorkflowLibrary } from "@/components/workflow-library";
import { getWorkflowCatalog } from "@/lib/workflow-catalog";

export default function NorthAmericaWorkflowsPage() {
  return <WorkflowLibrary workflows={getWorkflowCatalog("north-america")} basePath="/na" />;
}
