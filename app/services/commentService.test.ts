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

// Import after mock so the module picks up our test db
import {
  getCommentsForLesson,
  getCommentById,
  createComment,
  editComment,
  deleteComment,
} from "./commentService";
import { createModule } from "./moduleService";
import { createLesson } from "./lessonService";

let lessonId: number;

describe("commentService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);

    const mod = createModule(base.course.id, "Test Module", 1);
    const lesson = createLesson(mod.id, "Test Lesson", null, null, 1, null);
    lessonId = lesson.id;
  });

  describe("createComment", () => {
    it("creates a comment", () => {
      const comment = createComment(base.user.id, lessonId, "Hello world");

      expect(comment).toBeDefined();
      expect(comment.userId).toBe(base.user.id);
      expect(comment.lessonId).toBe(lessonId);
      expect(comment.content).toBe("Hello world");
      expect(comment.editedAt).toBeNull();
      expect(comment.createdAt).toBeDefined();
    });
  });

  describe("getCommentsForLesson", () => {
    it("returns comments with author data", () => {
      createComment(base.user.id, lessonId, "First comment");
      createComment(base.instructor.id, lessonId, "Second comment");

      const comments = getCommentsForLesson(lessonId);

      expect(comments).toHaveLength(2);
      expect(comments[0].content).toBe("First comment");
      expect(comments[0].authorName).toBe(base.user.name);
      expect(comments[1].content).toBe("Second comment");
      expect(comments[1].authorName).toBe(base.instructor.name);
    });

    it("returns empty array when no comments exist", () => {
      const comments = getCommentsForLesson(lessonId);
      expect(comments).toHaveLength(0);
    });
  });

  describe("getCommentById", () => {
    it("returns a comment by id", () => {
      const created = createComment(base.user.id, lessonId, "Test");
      const found = getCommentById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it("returns undefined for unknown id", () => {
      expect(getCommentById(9999)).toBeUndefined();
    });
  });

  describe("editComment", () => {
    it("updates content and sets editedAt", () => {
      const comment = createComment(base.user.id, lessonId, "Original");
      const edited = editComment(comment.id, "Updated", base.instructor.id);

      expect(edited).toBeDefined();
      expect(edited!.content).toBe("Updated");
      expect(edited!.editedAt).not.toBeNull();
      expect(edited!.editedByUserId).toBe(base.instructor.id);
    });

    it("editedAt starts as null", () => {
      const comment = createComment(base.user.id, lessonId, "Original");
      expect(comment.editedAt).toBeNull();
    });
  });

  describe("deleteComment", () => {
    it("removes a comment", () => {
      const comment = createComment(base.user.id, lessonId, "To delete");
      deleteComment(comment.id);

      expect(getCommentById(comment.id)).toBeUndefined();
    });

    it("returns the deleted comment", () => {
      const comment = createComment(base.user.id, lessonId, "To delete");
      const deleted = deleteComment(comment.id);

      expect(deleted).toBeDefined();
      expect(deleted!.id).toBe(comment.id);
    });
  });
});
