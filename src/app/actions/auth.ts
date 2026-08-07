"use server";

import { redirect } from "next/navigation";
import { authenticate, createSession, destroySession, getCurrentUser } from "@/lib/auth";
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
