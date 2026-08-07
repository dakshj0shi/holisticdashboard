import "server-only";
import { db } from "./db";

export async function loadWorksheets() {
  return db.worksheet.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true, assignments: true } } },
  });
}

export async function loadWorksheet(worksheetId: string) {
  return db.worksheet.findUnique({
    where: { id: worksheetId },
    include: { items: { orderBy: { order: "asc" } } },
  });
}

export async function loadAssignment(assignmentId: string) {
  return db.worksheetAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      worksheet: { include: { items: { orderBy: { order: "asc" } } } },
      batch: true,
    },
  });
}

// Per-statement average (Likert items only) + response distribution across all
// submissions for a single assignment.
export async function loadAssignmentResults(assignmentId: string) {
  const assignment = await loadAssignment(assignmentId);
  if (!assignment) return null;

  const submissions = await db.worksheetSubmission.findMany({
    where: { assignmentId },
    include: { answers: true, user: { select: { name: true } } },
  });

  const perStatement = assignment.worksheet.items
    .filter((it) => it.type === "likert5")
    .map((item) => {
      const values = submissions
        .flatMap((s) => s.answers.filter((a) => a.itemId === item.id))
        .map((a) => a.valueInt)
        .filter((v): v is number => v !== null);

      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const distribution = [1, 2, 3, 4, 5].map((n) => ({
        label: String(n),
        count: values.filter((v) => v === n).length,
      }));

      return { itemId: item.id, prompt: item.prompt, avg, distribution };
    });

  // Founders Mentality score: mean of every Likert answer. Computed per submission so
  // individuals can be banded, and overall for the group headline.
  const likertItemIds = new Set(assignment.worksheet.items.filter((it) => it.type === "likert5").map((it) => it.id));
  const perSubmission = submissions.map((s) => {
    const values = s.answers
      .filter((a) => likertItemIds.has(a.itemId))
      .map((a) => a.valueInt)
      .filter((v): v is number => v !== null);
    return {
      userName: s.user.name,
      submittedAt: s.submittedAt,
      avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    };
  });

  const scored = perSubmission.map((s) => s.avg).filter((v): v is number => v !== null);
  const overallAvg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;

  return {
    assignment,
    submissionCount: submissions.length,
    perStatement,
    overallAvg,
    submissionAverages: scored,
    submissions: perSubmission,
  };
}

// Pre vs post comparison for a worksheet within one batch — pairs the two
// assignments (timing "pre" / "post") that share the same worksheet+batch.
export async function loadPrePostComparison(worksheetId: string, batchId: string) {
  const assignments = await db.worksheetAssignment.findMany({
    where: { worksheetId, batchId, timing: { in: ["pre", "post"] } },
  });
  const pre = assignments.find((a) => a.timing === "pre");
  const post = assignments.find((a) => a.timing === "post");
  if (!pre || !post) return null;

  const [preResults, postResults] = await Promise.all([
    loadAssignmentResults(pre.id),
    loadAssignmentResults(post.id),
  ]);
  if (!preResults || !postResults) return null;

  const data = preResults.perStatement.map((p) => {
    const post = postResults.perStatement.find((x) => x.itemId === p.itemId);
    return { prompt: p.prompt, pre: p.avg, post: post?.avg ?? 0 };
  });

  return {
    data,
    preSubmissions: preResults.submissionCount,
    postSubmissions: postResults.submissionCount,
    preAvg: preResults.overallAvg,
    postAvg: postResults.overallAvg,
  };
}

// A single trainee's own pre/post answers for one worksheet in their batch —
// used on the trainee-facing /results page.
export async function loadTraineePrePost(userId: string, worksheetId: string, batchId: string) {
  const assignments = await db.worksheetAssignment.findMany({
    where: { worksheetId, batchId, timing: { in: ["pre", "post"] } },
    include: { worksheet: { include: { items: { orderBy: { order: "asc" } } } } },
  });
  const pre = assignments.find((a) => a.timing === "pre");
  const post = assignments.find((a) => a.timing === "post");
  if (!pre) return null;

  const [preSub, postSub] = await Promise.all([
    db.worksheetSubmission.findUnique({
      where: { assignmentId_userId: { assignmentId: pre.id, userId } },
      include: { answers: true },
    }),
    post
      ? db.worksheetSubmission.findUnique({
          where: { assignmentId_userId: { assignmentId: post.id, userId } },
          include: { answers: true },
        })
      : null,
  ]);

  if (!preSub) return null;

  const items = pre.worksheet.items.filter((it) => it.type === "likert5");
  const data = items.map((it) => {
    const preAns = preSub.answers.find((a) => a.itemId === it.id)?.valueInt ?? 0;
    const postAns = postSub?.answers.find((a) => a.itemId === it.id)?.valueInt ?? 0;
    return { prompt: it.prompt, pre: preAns, post: postAns };
  });

  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
  const preAvg = avg(data.map((d) => d.pre).filter((v) => v > 0));
  const postAvg = postSub ? avg(data.map((d) => d.post).filter((v) => v > 0)) : null;

  return { data, hasPost: Boolean(postSub), preAvg, postAvg, worksheetTitle: pre.worksheet.title };
}

// Every worksheet a trainee has a "pre" assignment for in their batch, each paired with
// their own pre/post result — shared by the trainee's own /results page and the admin's
// view of a single trainee (admin/trainees/[id]).
export async function loadUserProgress(userId: string, batchId: string | null) {
  if (!batchId) return [];

  const worksheetIds = (
    await db.worksheetAssignment.findMany({
      where: { batchId, timing: "pre" },
      select: { worksheetId: true },
      distinct: ["worksheetId"],
    })
  ).map((a) => a.worksheetId);

  const worksheets = await db.worksheet.findMany({ where: { id: { in: worksheetIds } } });
  return Promise.all(
    worksheets.map(async (w) => ({ worksheet: w, result: await loadTraineePrePost(userId, w.id, batchId) })),
  );
}
