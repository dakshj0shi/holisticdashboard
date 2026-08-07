import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { BrandMark } from "@/components/BrandMark";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-indigo-deep text-paper lg:block">
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <BrandMark size={34} />
            <span className="font-display text-xl">Founders Mentality</span>
          </div>
          <div className="max-w-md">
            <h1 className="font-display text-4xl leading-tight text-paper">
              Track the shift from insurgent to founder-led thinking, session by session.
            </h1>
            <p className="mt-4 text-paper/80">
              Schedules, reflections, and worksheets for every batch — in one place for
              facilitators and trainees alike.
            </p>
          </div>
          <p className="text-sm text-paper/60">Founders Mentality Program · Jaipur Rugs</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="text-indigo">
              <BrandMark size={30} />
            </span>
            <span className="font-display text-lg">Founders Mentality Portal</span>
          </div>

          <h2 className="font-display text-2xl text-ink">Welcome back</h2>
          <p className="mt-1 mb-8 text-sm text-muted">
            Trainees: sign in with your registered email. Facilitators: sign in with your Jaipur
            Rugs mailbox email and password.
          </p>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
