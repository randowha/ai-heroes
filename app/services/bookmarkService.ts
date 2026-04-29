import { eq, and, or } from "drizzle-orm";
import { db } from "~/db";
import { lessonBookmarks, lessons, modules } from "~/db/schema";

export function toggleBookmark(
  userId: number,
  lessonId: number
): { bookmarked: boolean } {
  const existing = db
    .select()
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, userId),
        eq(lessonBookmarks.lessonId, lessonId)
      )
    )
    .get();

  if (existing) {
    db.delete(lessonBookmarks)
      .where(
        and(
          eq(lessonBookmarks.userId, userId),
          eq(lessonBookmarks.lessonId, lessonId)
        )
      )
      .run();
    return { bookmarked: false };
  } else {
    db.insert(lessonBookmarks).values({ userId, lessonId }).run();
    return { bookmarked: true };
  }
}

export function isLessonBookmarked(userId: number, lessonId: number): boolean {
  const result = db
    .select()
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, userId),
        eq(lessonBookmarks.lessonId, lessonId)
      )
    )
    .get();
  return !!result;
}

export function getBookmarkedLessonIds(
  userId: number,
  courseId: number
): number[] {
  const courseModules = db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .all();

  if (courseModules.length === 0) return [];

  const courseLessons = db
    .select({ id: lessons.id })
    .from(lessons)
    .where(or(...courseModules.map((m) => eq(lessons.moduleId, m.id)))!)
    .all();

  if (courseLessons.length === 0) return [];

  const bookmarks = db
    .select({ lessonId: lessonBookmarks.lessonId })
    .from(lessonBookmarks)
    .where(
      and(
        eq(lessonBookmarks.userId, userId),
        or(...courseLessons.map((l) => eq(lessonBookmarks.lessonId, l.id)))!
      )
    )
    .all();

  return bookmarks.map((b) => b.lessonId);
}
