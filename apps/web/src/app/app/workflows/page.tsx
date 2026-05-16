import { WorkflowLibrary } from "@/components/workflow-library";
import { getWorkflowCatalog } from "@/lib/workflow-catalog";

export default function WorkflowsPage() {
  return <WorkflowLibrary workflows={getWorkflowCatalog("india")} basePath="/app" />;
}
