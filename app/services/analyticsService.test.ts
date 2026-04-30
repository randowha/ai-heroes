import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  getRevenueByMonth,
  getEnrollmentsByMonth,
  getLessonCompletionRates,
  getQuizPassRates,
  getDropOffLesson,
} from "./analyticsService";

describe("analyticsService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  // ─── getRevenueByMonth ───

  describe("getRevenueByMonth", () => {
    it("returns 12 months in YYYY-MM order", () => {
      const result = getRevenueByMonth({ courseId: base.course.id });
      expect(result).toHaveLength(12);
      // months must be in ascending order
      for (let i = 1; i < result.length; i++) {
        expect(result[i].month > result[i - 1].month).toBe(true);
      }
    });

    it("returns zero for all months when no purchases exist", () => {
      const result = getRevenueByMonth({ courseId: base.course.id });
      expect(result.every((r) => r.totalCents === 0)).toBe(true);
    });

    it("sums pricePaid for purchases in the correct month", () => {
      // Insert a purchase dated 3 months ago
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const month = threeMonthsAgo.toISOString().slice(0, 7); // YYYY-MM

      testDb.insert(schema.purchases).values({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 4999,
        createdAt: threeMonthsAgo.toISOString(),
      }).run();

      const result = getRevenueByMonth({ courseId: base.course.id });
      const row = result.find((r) => r.month === month);
      expect(row).toBeDefined();
      expect(row!.totalCents).toBe(4999);
    });

    it("excludes purchases older than 12 months", () => {
      const old = new Date();
      old.setMonth(old.getMonth() - 13);

      testDb.insert(schema.purchases).values({
        userId: base.user.id,
        courseId: base.course.id,
        pricePaid: 9999,
        createdAt: old.toISOString(),
      }).run();

      const result = getRevenueByMonth({ courseId: base.course.id });
      expect(result.every((r) => r.totalCents === 0)).toBe(true);
    });

    it("excludes purchases from other courses", () => {
      const otherCourse = testDb
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "Another",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();

      testDb.insert(schema.purchases).values({
        userId: base.user.id,
        courseId: otherCourse.id,
        pricePaid: 4999,
        createdAt: new Date().toISOString(),
      }).run();

      const result = getRevenueByMonth({ courseId: base.course.id });
      expect(result.every((r) => r.totalCents === 0)).toBe(true);
    });

    it("aggregates multiple purchases in the same month", () => {
      const now = new Date().toISOString();
      testDb.insert(schema.purchases).values([
        { userId: base.user.id, courseId: base.course.id, pricePaid: 1000, createdAt: now },
        { userId: base.instructor.id, courseId: base.course.id, pricePaid: 2000, createdAt: now },
      ]).run();

      const result = getRevenueByMonth({ courseId: base.course.id });
      const thisMonth = new Date().toISOString().slice(0, 7);
      const row = result.find((r) => r.month === thisMonth);
      expect(row!.totalCents).toBe(3000);
    });
  });

  // ─── getEnrollmentsByMonth ───

  describe("getEnrollmentsByMonth", () => {
    it("returns 12 months in YYYY-MM order", () => {
      const result = getEnrollmentsByMonth({ courseId: base.course.id });
      expect(result).toHaveLength(12);
      for (let i = 1; i < result.length; i++) {
        expect(result[i].month > result[i - 1].month).toBe(true);
      }
    });

    it("returns zero for all months when no enrollments", () => {
      const result = getEnrollmentsByMonth({ courseId: base.course.id });
      expect(result.every((r) => r.count === 0)).toBe(true);
    });

    it("counts enrollments in the correct month", () => {
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      const month = twoMonthsAgo.toISOString().slice(0, 7);

      testDb.insert(schema.enrollments).values({
        userId: base.user.id,
        courseId: base.course.id,
        enrolledAt: twoMonthsAgo.toISOString(),
      }).run();

      const result = getEnrollmentsByMonth({ courseId: base.course.id });
      const row = result.find((r) => r.month === month);
      expect(row!.count).toBe(1);
    });

    it("excludes enrollments older than 12 months", () => {
      const old = new Date();
      old.setMonth(old.getMonth() - 13);

      testDb.insert(schema.enrollments).values({
        userId: base.user.id,
        courseId: base.course.id,
        enrolledAt: old.toISOString(),
      }).run();

      const result = getEnrollmentsByMonth({ courseId: base.course.id });
      expect(result.every((r) => r.count === 0)).toBe(true);
    });
  });

  // ─── getLessonCompletionRates ───

  describe("getLessonCompletionRates", () => {
    it("returns empty array for a course with no lessons", () => {
      const result = getLessonCompletionRates({ courseId: base.course.id });
      expect(result).toHaveLength(0);
    });

    it("returns 0% completion for enrolled users who haven't started", () => {
      const mod = testDb.insert(schema.modules).values({ courseId: base.course.id, title: "Mod 1", position: 1 }).returning().get();
      testDb.insert(schema.lessons).values({ moduleId: mod.id, title: "L1", position: 1 }).run();
      testDb.insert(schema.enrollments).values({ userId: base.user.id, courseId: base.course.id }).run();

      const result = getLessonCompletionRates({ courseId: base.course.id });
      expect(result).toHaveLength(1);
      expect(result[0].completionRate).toBe(0);
    });

    it("returns 100% when all enrolled users completed the lesson", () => {
      const mod = testDb.insert(schema.modules).values({ courseId: base.course.id, title: "Mod 1", position: 1 }).returning().get();
      const lesson = testDb.insert(schema.lessons).values({ moduleId: mod.id, title: "L1", position: 1 }).returning().get();
      testDb.insert(schema.enrollments).values({ userId: base.user.id, courseId: base.course.id }).run();
      testDb.insert(schema.lessonProgress).values({ userId: base.user.id, lessonId: lesson.id, status: schema.LessonProgressStatus.Completed }).run();

      const result = getLessonCompletionRates({ courseId: base.course.id });
      expect(result[0].completionRate).toBe(100);
    });

    it("orders lessons by module.position then lesson.position", () => {
      const mod1 = testDb.insert(schema.modules).values({ courseId: base.course.id, title: "Mod 1", position: 1 }).returning().get();
      const mod2 = testDb.insert(schema.modules).values({ courseId: base.course.id, title: "Mod 2", position: 2 }).returning().get();
      testDb.insert(schema.lessons).values({ moduleId: mod1.id, title: "L1-2", position: 2 }).run();
      testDb.insert(schema.lessons).values({ moduleId: mod1.id, title: "L1-1", position: 1 }).run();
      testDb.insert(schema.lessons).values({ moduleId: mod2.id, title: "L2-1", position: 1 }).run();

      const result = getLessonCompletionRates({ courseId: base.course.id });
      expect(result.map((r) => r.lessonTitle)).toEqual(["L1-1", "L1-2", "L2-1"]);
    });

    it("returns 0% for all lessons when no enrollments", () => {
      const mod = testDb.insert(schema.modules).values({ courseId: base.course.id, title: "Mod 1", position: 1 }).returning().get();
      testDb.insert(schema.lessons).values({ moduleId: mod.id, title: "L1", position: 1 }).run();

      const result = getLessonCompletionRates({ courseId: base.course.id });
      expect(result[0].completionRate).toBe(0);
    });
  });

  // ─── getQuizPassRates ───

  describe("getQuizPassRates", () => {
    it("returns empty array when no quizzes", () => {
      const result = getQuizPassRates({ courseId: base.course.id });
      expect(result).toHaveLength(0);
    });

    it("returns 0 attempts and 0% pass rate with no attempts", () => {
      const mod = testDb.insert(schema.modules).values({ courseId: base.course.id, title: "Mod 1", position: 1 }).returning().get();
      const lesson = testDb.insert(schema.lessons).values({ moduleId: mod.id, title: "L1", position: 1 }).returning().get();
      testDb.insert(schema.quizzes).values({ lessonId: lesson.id, title: "Q1", passingScore: 0.7 }).run();

      const result = getQuizPassRates({ courseId: base.course.id });
      expect(result).toHaveLength(1);
      expect(result[0].totalAttempts).toBe(0);
      expect(result[0].passRate).toBe(0);
    });

    it("calculates pass rate correctly", () => {
      const mod = testDb.insert(schema.modules).values({ courseId: base.course.id, title: "Mod 1", position: 1 }).returning().get();
      const lesson = testDb.insert(schema.lessons).values({ moduleId: mod.id, title: "L1", position: 1 }).returning().get();
      const quiz = testDb.insert(schema.quizzes).values({ lessonId: lesson.id, title: "Quiz", passingScore: 0.7 }).returning().get();

      testDb.insert(schema.quizAttempts).values([
        { userId: base.user.id, quizId: quiz.id, score: 0.9, passed: true },
        { userId: base.instructor.id, quizId: quiz.id, score: 0.5, passed: false },
        { userId: base.user.id, quizId: quiz.id, score: 0.8, passed: true },
        { userId: base.user.id, quizId: quiz.id, score: 0.7, passed: true },
      ]).run();

      const result = getQuizPassRates({ courseId: base.course.id });
      expect(result[0].totalAttempts).toBe(4);
      expect(result[0].passRate).toBe(75); // 3/4 = 75%
    });

    it("excludes quizzes from other courses", () => {
      const otherCourse = testDb.insert(schema.courses).values({
        title: "Other", slug: "other", description: "x",
        instructorId: base.instructor.id, categoryId: base.category.id,
        status: schema.CourseStatus.Published,
      }).returning().get();
      const mod = testDb.insert(schema.modules).values({ courseId: otherCourse.id, title: "M", position: 1 }).returning().get();
      const lesson = testDb.insert(schema.lessons).values({ moduleId: mod.id, title: "L", position: 1 }).returning().get();
      testDb.insert(schema.quizzes).values({ lessonId: lesson.id, title: "Q", passingScore: 0.7 }).run();

      const result = getQuizPassRates({ courseId: base.course.id });
      expect(result).toHaveLength(0);
    });
  });

  // ─── getDropOffLesson ───

  describe("getDropOffLesson", () => {
    it("returns null for a course with no lessons", () => {
      expect(getDropOffLesson({ courseId: base.course.id })).toBeNull();
    });

    it("returns null for a course with only one lesson", () => {
      const mod = testDb.insert(schema.modules).values({ courseId: base.course.id, title: "M", position: 1 }).returning().get();
      testDb.insert(schema.lessons).values({ moduleId: mod.id, title: "L1", position: 1 }).run();

      expect(getDropOffLesson({ courseId: base.course.id })).toBeNull();
    });

    it("returns null when no lesson has any completion data (all zero)", () => {
      const mod = testDb.insert(schema.modules).values({ courseId: base.course.id, title: "M", position: 1 }).returning().get();
      testDb.insert(schema.lessons).values([
        { moduleId: mod.id, title: "L1", position: 1 },
        { moduleId: mod.id, title: "L2", position: 2 },
      ]).run();
      testDb.insert(schema.enrollments).values({ userId: base.user.id, courseId: base.course.id }).run();

      expect(getDropOffLesson({ courseId: base.course.id })).toBeNull();
    });

    it("identifies the lesson with the largest completion drop", () => {
      const mod = testDb.insert(schema.modules).values({ courseId: base.course.id, title: "M", position: 1 }).returning().get();
      const l1 = testDb.insert(schema.lessons).values({ moduleId: mod.id, title: "L1", position: 1 }).returning().get();
      const l2 = testDb.insert(schema.lessons).values({ moduleId: mod.id, title: "L2", position: 2 }).returning().get();
      const l3 = testDb.insert(schema.lessons).values({ moduleId: mod.id, title: "L3", position: 3 }).returning().get();

      // Enroll 4 users
      const u2 = testDb.insert(schema.users).values({ name: "U2", email: "u2@x.com", role: schema.UserRole.Student }).returning().get();
      const u3 = testDb.insert(schema.users).values({ name: "U3", email: "u3@x.com", role: schema.UserRole.Student }).returning().get();
      const u4 = testDb.insert(schema.users).values({ name: "U4", email: "u4@x.com", role: schema.UserRole.Student }).returning().get();

      for (const uid of [base.user.id, u2.id, u3.id, u4.id]) {
        testDb.insert(schema.enrollments).values({ userId: uid, courseId: base.course.id }).run();
      }

      // L1: 4/4 = 100%, L2: 1/4 = 25%, L3: 1/4 = 25%
      // Drop L1→L2: -75, L2→L3: 0 → drop-off is L2
      for (const uid of [base.user.id, u2.id, u3.id, u4.id]) {
        testDb.insert(schema.lessonProgress).values({ userId: uid, lessonId: l1.id, status: schema.LessonProgressStatus.Completed }).run();
      }
      testDb.insert(schema.lessonProgress).values({ userId: base.user.id, lessonId: l2.id, status: schema.LessonProgressStatus.Completed }).run();
      testDb.insert(schema.lessonProgress).values({ userId: base.user.id, lessonId: l3.id, status: schema.LessonProgressStatus.Completed }).run();

      const result = getDropOffLesson({ courseId: base.course.id });
      expect(result).not.toBeNull();
      expect(result!.lessonTitle).toBe("L2");
      expect(result!.delta).toBeLessThan(0);
    });
  });
});
