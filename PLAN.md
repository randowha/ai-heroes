# Plan: Instructor Analytics Tab

Reference PRD: `PRD-instructor-analytics.md`

## Steps

### 1. Create `app/services/analyticsService.ts`

Implement five pure query functions (all use named `opts` object params per project convention):

- `getRevenueByMonth({ courseId: number })` → `{ month: string; totalCents: number }[]`
  - Filter `purchases` by `courseId` and `createdAt >= 12 months ago`
  - Group by `strftime('%Y-%m', created_at)`
  - Left-join onto a generated 12-month array so zero months appear

- `getEnrollmentsByMonth({ courseId: number })` → `{ month: string; count: number }[]`
  - Same shape as revenue, sourced from `enrollments.enrolledAt`

- `getLessonCompletionRates({ courseId: number })` → `{ lessonId: number; lessonTitle: string; moduleTitle: string; globalPosition: number; completionRate: number }[]`
  - Join `modules` → `lessons` → `lessonProgress` (status = 'completed')
  - Denominator: count of distinct enrolled users from `enrollments` for this course
  - Order by `modules.position * 10000 + lessons.position`

- `getQuizPassRates({ courseId: number })` → `{ quizId: number; quizTitle: string; lessonTitle: string; totalAttempts: number; passRate: number }[]`
  - Join `quizzes` → `quizAttempts`, filter to lessons in this course
  - passRate = passed attempts / total attempts * 100

- `getDropOffLesson({ courseId: number })` → `{ lessonId: number; lessonTitle: string; delta: number } | null`
  - Call `getLessonCompletionRates` internally (or reuse its result from the loader)
  - Find the pair of consecutive lessons with the largest negative delta
  - Return `null` if fewer than 2 lessons have completion data

### 2. Update the loader in `app/routes/instructor.$courseId.tsx`

- Import and call all five analytics functions
- Pass `courseId` from `params`
- Add results to the returned loader data object:
  ```
  revenueByMonth, enrollmentsByMonth, lessonCompletionRates, quizPassRates, dropOffLesson
  ```
- Keep all existing loader data intact — this is purely additive

### 3. Add the Analytics tab to the UI

In the `Tabs` component (currently has: Content, Settings, Sales Copy, Students):

**TabsList** — add:
```
<TabsTrigger value="analytics">Analytics</TabsTrigger>
```

**TabsContent** — add a new `value="analytics"` panel with four sections:

#### Section A: Revenue
- Summary card: "Total revenue (last 12 months)" in dollars
- CSS bar chart: one bar per month, height proportional to max monthly revenue
- Bar tooltip / label: `$X` on hover (title attribute is fine)
- Empty state: "No purchases yet" if all values are zero

#### Section B: Enrollments
- Summary card: "New enrollments (last 12 months)" count
- CSS bar chart: same pattern as revenue
- Empty state: "No enrollments yet"

#### Section C: Lesson Completion Rates
- Table: Lesson title | Completion rate bar | Percentage
- Bar: inline CSS `width: X%` in a fixed-width container
- Drop-off lesson: add a warning badge (e.g. "Drop-off point") next to the lesson title
- Empty state: "No progress data yet" if no lessonProgress rows exist

#### Section D: Quiz Pass Rates
- Table: Quiz title | Lesson | Attempts | Pass rate badge
- Badge color: green if passRate ≥ 70, yellow 50–69, red < 50
- Empty state: "No quizzes in this course" if quizPassRates is empty

### 4. CSS Bar Chart Helper Component

Extract a small inline component (no separate file needed):

```tsx
function BarChart({ data, formatValue }: {
  data: { label: string; value: number }[];
  formatValue: (v: number) => string;
}) { ... }
```

Used by both Revenue and Enrollments sections. Pure CSS, no library.

### 5. Manual QA Checklist

- [ ] Analytics tab visible in course editor for instructor who owns the course
- [ ] Analytics tab visible for admin on any course
- [ ] Analytics tab NOT accessible for instructor who doesn't own the course (403)
- [ ] Revenue chart shows correct totals (pricePaid in cents → display in dollars)
- [ ] Zero months appear as empty bars (no gaps in the 12-month timeline)
- [ ] Drop-off lesson is highlighted; no highlight if fewer than 2 lessons
- [ ] Quiz pass rate badges use correct color thresholds
- [ ] All empty states render correctly for a brand-new course with no data

## No Migration Required

All data needed for analytics already exists in the current schema. No new tables or columns.

## File Touches Summary

| File | Change |
|------|--------|
| `app/services/analyticsService.ts` | **New** — five query functions |
| `app/routes/instructor.$courseId.tsx` | **Modified** — loader + new tab UI |
