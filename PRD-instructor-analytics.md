# PRD: Instructor Analytics Tab

## Problem Statement

Instructors have no visibility into how their courses are performing. They cannot see revenue trends, enrollment growth, how many students finish the course, whether students are passing quizzes, or where in the curriculum students give up. Without this data, instructors cannot make informed decisions about pricing, content improvements, or which lessons need the most attention.

## Solution

Add an **Analytics** tab to the existing instructor course editor page. The tab surfaces five categories of data — revenue trends, enrollment trends, per-lesson completion rates, per-quiz pass rates, and drop-off analysis — all scoped to the last 12 months where time-series data is relevant. All charts are rendered with pure CSS (no chart library dependency).

## User Stories

1. As an instructor, I want to see monthly revenue for my course over the last 12 months, so that I can identify seasonal trends and evaluate the impact of pricing changes.
2. As an instructor, I want to see the total revenue for my course at a glance, so that I understand my overall earnings without doing mental arithmetic.
3. As an instructor, I want to see a bar chart of monthly revenue, so that I can visually spot high and low earning months.
4. As an instructor, I want to see how many students enrolled each month over the last 12 months, so that I can gauge whether my marketing efforts are working.
5. As an instructor, I want to see the total number of enrollments for my course, so that I have an immediate sense of my course's reach.
6. As an instructor, I want to see a bar chart of monthly enrollments, so that I can spot growth or decline trends over time.
7. As an instructor, I want to see what percentage of enrolled students completed each lesson, so that I know which lessons students actually finish.
8. As an instructor, I want the per-lesson completion rates to be listed in lesson order, so that I can read them as a funnel from start to finish.
9. As an instructor, I want to see which lesson has the steepest drop in completion rate compared to the previous lesson, so that I know exactly where to focus improvement efforts.
10. As an instructor, I want the drop-off lesson to be visually highlighted, so that I can find the problem point at a glance.
11. As an instructor, I want to see the pass rate for each quiz in my course, so that I know which quizzes students are struggling with.
12. As an instructor, I want the quiz pass rates to show the quiz title and the associated lesson title, so that I can identify which part of the curriculum each quiz belongs to.
13. As an instructor, I want all analytics data scoped to my own course, so that I cannot see data from other instructors' courses.
14. As an admin, I want to be able to view analytics for any course, so that I can monitor platform-wide course quality.
15. As an instructor with no enrollments yet, I want to see a meaningful empty state, so that I understand the page is working but the course has no data yet.
16. As an instructor, I want the Analytics tab to load within the existing course editor page without a full navigation, so that I can switch between analytics and content editing without losing context.

## Implementation Decisions

### Modules

**New: `analyticsService.ts`**

A pure service module with five query functions. Each function accepts `courseId` as a named parameter and returns plain data objects. No side effects.

- `getRevenueByMonth({ courseId })` — Returns an array of `{ month: string (YYYY-MM), totalCents: number }` for the last 12 calendar months. Queries the `purchases` table filtered by `courseId` and `createdAt` range.
- `getEnrollmentsByMonth({ courseId })` — Returns an array of `{ month: string (YYYY-MM), count: number }` for the last 12 calendar months. Queries the `enrollments` table.
- `getLessonCompletionRates({ courseId })` — Returns an array of `{ lessonId, lessonTitle, moduleTitle, position, completionRate: number (0–100) }` ordered by module position then lesson position. Completion rate = (distinct users with status = completed) / (total distinct enrolled users). Requires joining `modules`, `lessons`, `lessonProgress`, and `enrollments`.
- `getQuizPassRates({ courseId })` — Returns an array of `{ quizId, quizTitle, lessonTitle, totalAttempts: number, passRate: number (0–100) }`. Pass rate = attempts where passed = true / total attempts. Requires joining `quizzes`, `quizAttempts`, `lessons`, `modules`.
- `getDropOffLesson({ courseId })` — Returns the lesson with the largest negative delta in completion rate compared to its immediately preceding lesson (by position). Returns `{ lessonId, lessonTitle, delta: number }` or `null` if fewer than 2 lessons with data exist.

**Modified: `instructor.$courseId.tsx` loader**

Call the five new service functions in the loader and include their results in the returned data. No schema changes are required — all data is derivable from existing tables.

**Modified: `instructor.$courseId.tsx` component**

Add a fifth tab "Analytics" after the existing "Students" tab. The tab renders four sections:

1. **Revenue** — summary stat (total, last 12 months) + CSS bar chart of monthly revenue
2. **Enrollments** — summary stat (total, last 12 months) + CSS bar chart of monthly enrollments
3. **Lesson Completion** — table of lessons with a CSS bar in each row; drop-off lesson highlighted with a warning badge
4. **Quiz Pass Rates** — table of quizzes with pass rate shown as a percentage badge

### CSS Bar Chart Pattern

Each bar chart is a `<div>` with `display: flex; align-items: flex-end; gap: 4px`. Each bar is a `<div>` whose `height` is set inline as a percentage of the max value in the dataset. Month labels sit below each bar. No JavaScript animation needed.

### Data Scope

- Revenue and enrollment trend charts: last 12 complete calendar months (month boundaries based on `createdAt` ISO strings stored in the DB).
- Completion and quiz data: all-time (no time filter), as these represent the current state of the curriculum.

### Month Generation

The loader (or service) generates the list of the last 12 months as `YYYY-MM` strings and left-joins query results onto them, so months with zero activity still appear in the chart as empty bars.

### Authorization

The Analytics tab reuses the existing loader authorization logic (instructor owns course, or user is admin). No additional auth work needed.

## Testing Decisions

A good test for this feature tests the **output of each service function** given a known database state — not the SQL internals or the React components. Tests should:
- Seed the database with controlled fixture data
- Call the service function
- Assert on the returned array shape and values

Modules to test:
- `analyticsService.ts` — all five functions, covering: empty course (no purchases/enrollments), partial data, edge cases (single lesson, no quizzes, all students passing, no students passing, drop-off on first vs. last lesson)

Prior art for service-layer tests: look at existing service files in `app/services/` for patterns — the services use synchronous better-sqlite3 calls, so tests can be straightforward synchronous assertions with a test DB.

The React tab component is **not** unit tested — visual layout is verified manually.

## Out of Scope

- PPP (purchasing power parity) revenue breakdown
- Per-student drill-down from the Analytics tab (the existing Students tab covers this)
- Course-level completion rate aggregate (per-lesson rates provide a richer picture)
- Quiz pass rate trend over time
- Export to CSV/PDF
- Real-time / live-updating analytics
- Platform-wide analytics across all courses for admins (each analytics view is scoped to one course)
- Email digests or notifications when metrics change

## Further Notes

- `pricePaid` is stored in **integer cents** in the `purchases` table. The UI must display values in dollars (divide by 100).
- The `lessonProgress` table tracks per-user, per-lesson status. Completion rate denominators use **enrolled users** (from `enrollments`), not total platform users, to avoid artificially deflating rates.
- The drop-off detection compares consecutive lessons by their position within the course. If a module boundary exists between two lessons, the position ordering should be global (module.position * large_offset + lesson.position) to avoid cross-module confusion.
- No database migration is required for this feature.
