import { DashboardNav } from "../dashboard/nav";
import { requireUser } from "@/lib/session";

export default async function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireUser();
  return (
    <div className="flex min-h-screen flex-col">
      <DashboardNav userEmail={email} />
      <main id="main-content" className="app-main"><div className="app-content">{children}</div></main>
    </div>
  );
}
