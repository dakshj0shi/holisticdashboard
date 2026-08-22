import { redirect } from "next/navigation";
import { getCurrentUser, hasMailCredential } from "@/lib/auth";
import { ConsoleSidebar } from "@/components/ConsoleSidebar";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const canSendMail = await hasMailCredential();

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <ConsoleSidebar name={user.name} />
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8">
        {!canSendMail && (
          <div className="mb-6 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber">
            <span className="font-medium">Email sending is off for this session.</span> You signed in with a
            stored password because the mail server could not be reached, so scheduling and summary emails
            are recorded as skipped rather than sent. Everything else in the console works normally.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
