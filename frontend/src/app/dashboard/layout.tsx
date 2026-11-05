import WorkspaceFrame from "@/components/workspace-frame";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceFrame>{children}</WorkspaceFrame>;
}
