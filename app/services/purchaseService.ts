import { eq, and } from "drizzle-orm";
import { db } from "~/db";
import { purchases } from "~/db/schema";

// ─── Purchase Service ───
// Handles purchase records (transaction log separate from enrollments).
// Uses positional parameters (project convention).

export function createPurchase(
  userId: number,
  courseId: number,
  pricePaid: number,
  country: string | null
) {
  return db
    .insert(purchases)
    .values({ userId, courseId, pricePaid, country })
    .returning()
    .get();
}

export function findPurchase(userId: number, courseId: number) {
  return db
    .select()
    .from(purchases)
    .where(
      and(eq(purchases.userId, userId), eq(purchases.courseId, courseId))
    )
    .get();
}

export function getPurchasesByUser(userId: number) {
  return db
    .select()
    .from(purchases)
    .where(eq(purchases.userId, userId))
    .all();
}

export function getPurchasesByCourse(courseId: number) {
  return db
    .select()
    .from(purchases)
    .where(eq(purchases.courseId, courseId))
    .all();
}
