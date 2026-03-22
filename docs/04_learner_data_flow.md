# Learner — Data Flow & Database Tables

> **Role:** `learner` — browses courses, enrolls, watches content, takes quizzes, earns points and badges.

---

## Phase 1: Browsing Courses

Tables read (no writes):

- `content_contententity` — list of published courses (`status_code=2`)
- `content_coursesettings` — visibility and access mode
- `taxonomy_entitycategory` + `taxonomy_category` — filter by category
- `taxonomy_entitytag` + `taxonomy_tag` — filter by tag
- `content_entitystats` — enrollment count, average rating, duration

---

## Phase 2: Enrolling in a Course

Table: `enrollment_coursemembership` — **one row per learner per course**

| Column | Value written on enroll |
|---|---|
| `course_entity_id` | Course being enrolled in |
| `user_id` | Learner's `User.id` |
| `membership_status` | 2 = Active |
| `access_mode` | 1 = Open (self-enrolled) |
| `enrolled_at` | `NOW()` |
| `progress_percent` | 0 |

Unique constraint: `(course_entity_id, user_id)` — prevents double enrollment.

---

## Phase 3: Consuming Lesson Content

### Viewing a Lesson

The learn page fetches the course structure by traversing:
1. `content_contententity` (the course)
2. `content_contentstructure` → child Modules
3. `content_contentstructure` → child Lessons per Module
4. Each lesson's detail table (`content_lessoncontent`, `content_videocontent`, etc.)
5. `content_contentattachment` — downloadable files

### Checking if a Lesson is Locked

`content_contentstructure.unlock_rule_code` determines when a child is accessible:
- `1` = Immediate (always unlocked)
- `2` = After previous lesson is completed
- `3` = After a prerequisite entity is completed

Prerequisite rules stored in `content_entityprerequisite`:

| Column | Notes |
|---|---|
| `entity_id` | The locked entity |
| `required_entity_id` | Must be completed first |

### Marking a Lesson Complete

Table: `enrollment_entityprogress` — **one row per learner per entity**

| Column | Value on completion |
|---|---|
| `learner_id` | |
| `entity_id` | Lesson / Video / Resource being completed |
| `progress_status` | 3 = Completed |
| `progress_percent` | 100 |
| `completed_at` | `NOW()` |
| `last_accessed_at` | `NOW()` |

After updating `EntityProgress`, the system recalculates:
→ `enrollment_coursemembership.progress_percent` (using the `recalculate_progress()` method)

---

## Phase 4: Taking a Quiz

### Starting a Quiz Attempt

Table: `quizzes_quizattempt`

| Column | Value |
|---|---|
| `quiz_entity_id` | ContentEntity with entity_type=5 |
| `learner_id` | |
| `attempt_no` | Auto-incremented (1, 2, 3…) |
| `started_at` | `NOW()` |
| `score` | 0 initially |

### Submitting Answers

Table: `quizzes_quizattemptanswer` — one row per question answered

| Column | Notes |
|---|---|
| `attempt_id` | → QuizAttempt |
| `question_id` | → QuizQuestion |
| `selected_option_id` | → QuizOption (for MCQ) |
| `text_answer` | For free-text questions |
| `is_correct` | Graded automatically |
| `marks_awarded` | |

After submission, `QuizAttempt` is updated:
- `score` = total marks earned
- `max_score` = total possible marks
- `percentage` = (score / max_score) × 100
- `is_passed` = `percentage >= QuizContent.pass_percentage`
- `submitted_at` = `NOW()`
- `points_earned` = looked up from `QuizRewardRule`

### Unique constraint
`(attempt_id, question_id)` — one answer per question per attempt.

---

## Phase 5: Earning Points and Badges

### On Quiz Pass

`quizzes_quizrewardrule` is checked for the current `attempt_no`. If a rule matches, `UserPointLedger.award_points()` is called:

1. Inserts into `gamification_userpointledger`:

| Column | Value |
|---|---|
| `user_id` | Learner |
| `source_type` | 1 = Quiz |
| `source_entity_id` | Quiz ContentEntity |
| `source_attempt_id` | QuizAttempt |
| `points` | From QuizRewardRule |
| `reason` | Auto-generated string |

2. Updates `accounts_user.points += points`

3. Checks all active badges in `gamification_badge`:
   - If `user.points >= badge.min_points` and badge not already in `gamification_userbadge` → inserts new row.

Table: `gamification_userbadge`

| Column | Value |
|---|---|
| `user_id` | |
| `badge_id` | |
| `awarded_at` | `NOW()` |

### Badge Levels (computed property on User)

| Points | Badge Label |
|---|---|
| 0–19 | None |
| 20–39 | Newbie |
| 40–59 | Explorer |
| 60–79 | Achiever |
| 80–99 | Specialist |
| 100–119 | Expert |
| 120+ | Master |

---

## Phase 6: Writing a Review

Table: `reviews_coursereview`

| Column | Notes |
|---|---|
| `course_entity_id` | |
| `user_id` | |
| `rating` | 1–5 stars |
| `review_text` | |
| `is_published` | `True` by default |
| `created_at` | |

Unique constraint: `(course_entity_id, user_id)` — one review per learner per course.

---

## Learner Lifecycle Data Flow

```
Learner registers  →  accounts_user (INSERT, role='learner')
        │
        ├─► Browse courses
        │     →  content_contententity (SELECT, status=Published)
        │     →  content_coursesettings
        │     →  content_entitystats
        │
        ├─► Enroll
        │     →  enrollment_coursemembership (INSERT)
        │
        ├─► View lesson
        │     →  content_contententity + content_contentstructure
        │     →  content_lessoncontent / videocontent / etc.
        │     →  enrollment_entityprogress (UPSERT, last_accessed_at)
        │
        ├─► Mark lesson complete
        │     →  enrollment_entityprogress (UPDATE, status=Completed)
        │     →  enrollment_coursemembership (UPDATE, progress_percent)
        │
        ├─► Take quiz
        │     →  quizzes_quizattempt (INSERT)
        │     →  quizzes_quizattemptanswer (INSERT per question)
        │     →  quizzes_quizattempt (UPDATE score/percentage/is_passed)
        │
        ├─► Pass quiz  →  earn points
        │     →  gamification_userpointledger (INSERT)
        │     →  accounts_user.points (UPDATE)
        │     →  gamification_userbadge (INSERT if threshold met)
        │
        └─► Write review
              →  reviews_coursereview (INSERT or UPDATE)
```
