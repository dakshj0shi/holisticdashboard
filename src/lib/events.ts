import "server-only";
import { db } from "./db";

// Fire-and-forget audit logging. Never let a logging failure break the action.
export async function logEvent(userId: string, type: string, detail?: string) {
  try {
    await db.event.create({ data: { userId, type, detail: detail ?? null } });
  } catch {
    // swallow — logging is best-effort
  }
}

export const EVENT_LABEL: Record<string, string> = {
  login: "Signed in",
  logout: "Signed out",
  password_change: "Changed password",
  batch_create: "Created batch",
  batch_update: "Updated batch",
  trainee_create: "Added trainee",
  facilitator_create: "Added facilitator",
  trainee_update: "Updated trainee",
  session_schedule: "Scheduled session",
  session_reschedule: "Rescheduled session",
  session_date_correct: "Corrected session date",
  session_complete: "Marked session complete",
  observation_save: "Saved observation",
  worksheet_create: "Created worksheet",
  worksheet_assign: "Assigned worksheet",
  worksheet_submit: "Submitted worksheet",
  import_run: "Ran Excel import",
  custom_email_send: "Sent custom email",
  email_template_update: "Edited email template",
};

export type ActivityRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  type: string;
  label: string;
  detail: string | null;
  at: string;
};

export async function loadActivity(opts: { page?: number; type?: string; q?: string }) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = 30;

  const where: Record<string, unknown> = {};
  if (opts.type) where.type = opts.type;
  if (opts.q) {
    where.user = {
      OR: [{ name: { contains: opts.q } }, { email: { contains: opts.q } }],
    };
  }

  const [rows, total] = await Promise.all([
    db.event.findMany({
      where,
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.event.count({ where }),
  ]);

  return {
    rows: rows.map((e): ActivityRow => ({
      id: e.id,
      name: e.user.name,
      email: e.user.email ?? "",
      role: e.user.role,
      type: e.type,
      label: EVENT_LABEL[e.type] ?? e.type,
      detail: e.detail,
      at: e.createdAt.toISOString().replace("T", " ").slice(0, 16),
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
