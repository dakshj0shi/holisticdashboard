"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { authenticate, createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/events";

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const result = await authenticate(email, password);
  if (!result) return { error: "Wrong email or password. Try again." };

  await createSession(result.user.id, result.mailPassword);
  await logEvent(result.user.id, "login");
  redirect(result.user.role === "admin" ? "/admin" : "/dashboard");
}

export async function logoutAction() {
  const u = await getCurrentUser();
  if (u) await logEvent(u.id, "logout");
  await destroySession();
  redirect("/login");
}

// Trainee self-service only — admins log in with their real mailbox password
// (verified live against MAIL_HOST), which this app has no ability to change.
export async function changePasswordAction(_prev: unknown, formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "trainee") return { error: "Not authorized." };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) return { error: "Fill in all fields." };
  if (newPassword.length < 6) return { error: "New password must be at least 6 characters." };
  if (newPassword !== confirmPassword) return { error: "New passwords don't match." };

  const user = await db.user.findUnique({ where: { id: currentUser.id } });
  if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return { error: "Current password is incorrect." };
  }

  await db.user.update({
    where: { id: currentUser.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });
  await logEvent(currentUser.id, "password_change");
  return { ok: true };
}
