import { Sidebar } from "@/components/layout/sidebar";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-[var(--background)]">
        {children}
      </main>
    </div>
  );
}
