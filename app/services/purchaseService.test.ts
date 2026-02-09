import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import {
  createPurchase,
  findPurchase,
  getPurchasesByUser,
  getPurchasesByCourse,
} from "./purchaseService";

describe("purchaseService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  // ─── Create Purchase ───

  describe("createPurchase", () => {
    it("creates a purchase record", () => {
      const purchase = createPurchase(base.user.id, base.course.id, 4999, "US");
      expect(purchase).toBeDefined();
      expect(purchase.userId).toBe(base.user.id);
      expect(purchase.courseId).toBe(base.course.id);
      expect(purchase.pricePaid).toBe(4999);
      expect(purchase.country).toBe("US");
    });

    it("creates a purchase with null country", () => {
      const purchase = createPurchase(base.user.id, base.course.id, 4999, null);
      expect(purchase.country).toBeNull();
    });

    it("stores discounted price correctly", () => {
      const purchase = createPurchase(base.user.id, base.course.id, 2500, "IN");
      expect(purchase.pricePaid).toBe(2500);
      expect(purchase.country).toBe("IN");
    });
  });

  // ─── Find Purchase ───

  describe("findPurchase", () => {
    it("returns purchase for user+course", () => {
      createPurchase(base.user.id, base.course.id, 4999, "US");
      const found = findPurchase(base.user.id, base.course.id);
      expect(found).toBeDefined();
      expect(found!.pricePaid).toBe(4999);
    });

    it("returns undefined when no purchase exists", () => {
      expect(findPurchase(base.user.id, base.course.id)).toBeUndefined();
    });
  });

  // ─── Get By User ───

  describe("getPurchasesByUser", () => {
    it("returns all purchases for a user", () => {
      createPurchase(base.user.id, base.course.id, 4999, "US");
      const purchases = getPurchasesByUser(base.user.id);
      expect(purchases).toHaveLength(1);
    });

    it("returns empty array when user has no purchases", () => {
      expect(getPurchasesByUser(base.user.id)).toHaveLength(0);
    });
  });

  // ─── Get By Course ───

  describe("getPurchasesByCourse", () => {
    it("returns all purchases for a course", () => {
      createPurchase(base.user.id, base.course.id, 4999, "US");
      createPurchase(base.instructor.id, base.course.id, 4999, "GB");
      const purchases = getPurchasesByCourse(base.course.id);
      expect(purchases).toHaveLength(2);
    });
  });
});
