import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default function AccountPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Account</h1>
      <p className="mt-1 mb-6 text-muted">Change the password you use to sign in.</p>
      <ChangePasswordForm />
    </div>
  );
}
