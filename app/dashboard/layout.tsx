import { DashboardNav } from "./nav";
import { requireUser } from "@/lib/session";
import { BootGate } from "./boot";
import { Footer } from "../components/footer";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireUser();
  return (
    <div className="flex min-h-screen flex-col">
      <DashboardNav userEmail={email} />
      <main id="main-content" className="app-main"><div className="app-content"><BootGate>{children}</BootGate></div></main>
      <Footer />
    </div>
  );
}
