import { eq, and, gte, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  purchases,
  enrollments,
  modules,
  lessons,
  lessonProgress,
  quizzes,
  quizAttempts,
  LessonProgressStatus,
} from "~/db/schema";

// ─── Analytics Service ───
// Pure query functions for instructor analytics.
// Uses named opts object params per project convention.

// ─── Helpers ───

/** Generates an array of YYYY-MM strings for the last 12 complete calendar months
 *  plus the current month, ending with the current month. */
function last12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${yyyy}-${mm}`);
  }
  return months;
}

/** ISO string for exactly 12 months ago (first day of that month at midnight). */
function twelveMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 11);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ─── Revenue ───

export function getRevenueByMonth(opts: { courseId: number }): {
  month: string;
  totalCents: number;
}[] {
  const { courseId } = opts;
  const since = twelveMonthsAgo();

  const rows = db
    .select({
      month: sql<string>`strftime('%Y-%m', ${purchases.createdAt})`,
      totalCents: sql<number>`sum(${purchases.pricePaid})`,
    })
    .from(purchases)
    .where(
      and(
        eq(purchases.courseId, courseId),
        gte(purchases.createdAt, since)
      )
    )
    .groupBy(sql`strftime('%Y-%m', ${purchases.createdAt})`)
    .all();

  const byMonth = new Map(rows.map((r) => [r.month, r.totalCents]));

  return last12Months().map((month) => ({
    month,
    totalCents: byMonth.get(month) ?? 0,
  }));
}

// ─── Enrollments ───

export function getEnrollmentsByMonth(opts: { courseId: number }): {
  month: string;
  count: number;
}[] {
  const { courseId } = opts;
  const since = twelveMonthsAgo();

  const rows = db
    .select({
      month: sql<string>`strftime('%Y-%m', ${enrollments.enrolledAt})`,
      count: sql<number>`count(*)`,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        gte(enrollments.enrolledAt, since)
      )
    )
    .groupBy(sql`strftime('%Y-%m', ${enrollments.enrolledAt})`)
    .all();

  const byMonth = new Map(rows.map((r) => [r.month, r.count]));

  return last12Months().map((month) => ({
    month,
    count: byMonth.get(month) ?? 0,
  }));
}

// ─── Lesson Completion Rates ───

export function getLessonCompletionRates(opts: { courseId: number }): {
  lessonId: number;
  lessonTitle: string;
  moduleTitle: string;
  globalPosition: number;
  completionRate: number;
}[] {
  const { courseId } = opts;

  // Total enrolled users for this course
  const enrolledResult = db
    .select({ count: sql<number>`count(distinct ${enrollments.userId})` })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .get();

  const totalEnrolled = enrolledResult?.count ?? 0;

  if (totalEnrolled === 0) {
    // Still return lessons with 0% completion
    const lessonRows = db
      .select({
        lessonId: lessons.id,
        lessonTitle: lessons.title,
        moduleTitle: modules.title,
        modulePosition: modules.position,
        lessonPosition: lessons.position,
      })
      .from(lessons)
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .where(eq(modules.courseId, courseId))
      .orderBy(modules.position, lessons.position)
      .all();

    return lessonRows.map((row) => ({
      lessonId: row.lessonId,
      lessonTitle: row.lessonTitle,
      moduleTitle: row.moduleTitle,
      globalPosition: row.modulePosition * 10000 + row.lessonPosition,
      completionRate: 0,
    }));
  }

  // Count distinct completions per lesson
  const completionRows = db
    .select({
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      moduleTitle: modules.title,
      modulePosition: modules.position,
      lessonPosition: lessons.position,
      completedCount: sql<number>`count(distinct ${lessonProgress.userId})`,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .leftJoin(
      lessonProgress,
      and(
        eq(lessonProgress.lessonId, lessons.id),
        eq(lessonProgress.status, LessonProgressStatus.Completed)
      )
    )
    .where(eq(modules.courseId, courseId))
    .groupBy(lessons.id)
    .orderBy(modules.position, lessons.position)
    .all();

  return completionRows.map((row) => ({
    lessonId: row.lessonId,
    lessonTitle: row.lessonTitle,
    moduleTitle: row.moduleTitle,
    globalPosition: row.modulePosition * 10000 + row.lessonPosition,
    completionRate: Math.round((row.completedCount / totalEnrolled) * 100),
  }));
}

// ─── Quiz Pass Rates ───

export function getQuizPassRates(opts: { courseId: number }): {
  quizId: number;
  quizTitle: string;
  lessonTitle: string;
  totalAttempts: number;
  passRate: number;
}[] {
  const { courseId } = opts;

  const rows = db
    .select({
      quizId: quizzes.id,
      quizTitle: quizzes.title,
      lessonTitle: lessons.title,
      totalAttempts: sql<number>`count(${quizAttempts.id})`,
      passedAttempts: sql<number>`sum(case when ${quizAttempts.passed} then 1 else 0 end)`,
    })
    .from(quizzes)
    .innerJoin(lessons, eq(quizzes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .leftJoin(quizAttempts, eq(quizAttempts.quizId, quizzes.id))
    .where(eq(modules.courseId, courseId))
    .groupBy(quizzes.id)
    .all();

  return rows.map((row) => ({
    quizId: row.quizId,
    quizTitle: row.quizTitle,
    lessonTitle: row.lessonTitle,
    totalAttempts: row.totalAttempts,
    passRate:
      row.totalAttempts > 0
        ? Math.round((row.passedAttempts / row.totalAttempts) * 100)
        : 0,
  }));
}

// ─── Drop-Off Lesson ───

export function getDropOffLesson(opts: { courseId: number }): {
  lessonId: number;
  lessonTitle: string;
  delta: number;
} | null {
  const rates = getLessonCompletionRates({ courseId: opts.courseId });

  // Need at least 2 lessons with completion data (completionRate > 0)
  if (rates.filter((r) => r.completionRate > 0).length < 2) return null;

  let maxDelta = 0;
  let dropOff: { lessonId: number; lessonTitle: string; delta: number } | null =
    null;

  for (let i = 1; i < rates.length; i++) {
    const delta = rates[i].completionRate - rates[i - 1].completionRate;
    if (delta < maxDelta) {
      maxDelta = delta;
      dropOff = {
        lessonId: rates[i].lessonId,
        lessonTitle: rates[i].lessonTitle,
        delta,
      };
    }
  }

  return dropOff;
}
