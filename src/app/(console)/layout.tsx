import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ConsoleSidebar } from "@/components/ConsoleSidebar";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <ConsoleSidebar name={user.name} />
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8">{children}</main>
    </div>
  );
}
