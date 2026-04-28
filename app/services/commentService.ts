import { eq, asc } from "drizzle-orm";
import { db } from "~/db";
import { lessonComments, users } from "~/db/schema";

// ─── Comment Service ───
// Handles lesson comment CRUD.
// Students can comment on enrolled lessons.
// Instructors can edit/delete any comment on their course's lessons.
// Admins can edit/delete any comment.

export function getCommentsForLesson(lessonId: number) {
  return db
    .select({
      id: lessonComments.id,
      lessonId: lessonComments.lessonId,
      userId: lessonComments.userId,
      content: lessonComments.content,
      editedAt: lessonComments.editedAt,
      createdAt: lessonComments.createdAt,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(lessonComments)
    .innerJoin(users, eq(lessonComments.userId, users.id))
    .where(eq(lessonComments.lessonId, lessonId))
    .orderBy(asc(lessonComments.createdAt))
    .all();
}

export function getCommentById(id: number) {
  return db
    .select()
    .from(lessonComments)
    .where(eq(lessonComments.id, id))
    .get();
}

export function createComment(
  userId: number,
  lessonId: number,
  content: string
) {
  return db
    .insert(lessonComments)
    .values({ userId, lessonId, content })
    .returning()
    .get();
}

export function editComment(
  commentId: number,
  newContent: string,
  editorUserId: number
) {
  return db
    .update(lessonComments)
    .set({
      content: newContent,
      editedAt: new Date().toISOString(),
      editedByUserId: editorUserId,
    })
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}

export function deleteComment(commentId: number) {
  return db
    .delete(lessonComments)
    .where(eq(lessonComments.id, commentId))
    .returning()
    .get();
}
