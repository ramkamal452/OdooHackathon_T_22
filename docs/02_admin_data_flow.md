# Admin — Data Flow & Database Tables

> **Role:** `admin` — full platform access. Can manage all users, courses, categories, badges, and reports.

---

## Tables Directly Used by Admin

### `accounts_user`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | Auto |
| `email` | varchar UK | Login identifier |
| `role` | varchar | `admin` / `instructor` / `learner` |
| `first_name` | varchar | |
| `last_name` | varchar | |
| `bio` | text | |
| `avatar` | varchar | Path to uploaded image |
| `points` | int | Computed from gamification |
| `last_login_at` | datetime | |
| `is_staff` | bool | Django admin access |
| `is_superuser` | bool | |
| `password` | varchar | Hashed (Django) |

**Admin actions:** Create users, change roles, reset passwords, deactivate accounts.

---

### `taxonomy_category`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `name` | varchar | |
| `slug` | slug UK | Auto-generated from name |
| `parent_id` | int FK → self | Optional sub-category |
| `created_at` | datetime | |

**Admin actions:** Create / edit / delete categories used to classify courses.

---

### `taxonomy_tag`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `name` | varchar | |
| `slug` | slug UK | |
| `created_at` | datetime | |

---

### `content_contententity`

Represents every content node: course, module, lesson, video, quiz, article, resource.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `entity_type` | int | 1=Course, 2=Module, 3=Lesson, 4=Video, 5=Quiz, 6=Article, 7=Resource |
| `title` | varchar | |
| `slug` | slug UK | Auto-generated |
| `short_description` | varchar | |
| `description` | text | |
| `owner_id` | int FK → User | Instructor who created it |
| `status_code` | int | 1=Draft, 2=Published, 3=Archived, 4=Hidden |
| `thumbnail_asset_id` | int FK → Asset | |
| `estimated_duration_seconds` | int | |
| `allow_standalone_enrollment` | bool | |
| `is_reusable` | bool | Can be added to multiple parents |
| `published_at` | datetime | |
| `created_at` | datetime | |
| `deleted_at` | datetime | Soft delete |

**Admin actions:** View all courses, change status (publish/archive/hide), assign ownership.

---

### `content_coursesettings`

One-to-one extension for entity_type=COURSE.

| Column | Type | Notes |
|---|---|---|
| `entity_id` | int PK FK → ContentEntity | |
| `visibility_code` | int | 1=Everyone, 2=Signed-in |
| `access_rule_code` | int | 1=Open, 2=Invitation, 3=Payment |
| `price` | decimal | Nullable |
| `website` | url | Optional course website |
| `responsible_id` | int FK → User | Point of contact admin |
| `level_code` | int | 1=Beginner, 2=Intermediate, 3=Advanced |

---

### `enrollment_coursemembership`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `course_entity_id` | int FK → ContentEntity | |
| `user_id` | int FK → User | Nullable (invited but not yet registered) |
| `invited_email` | email | For invite-only access |
| `invited_by_id` | int FK → User | |
| `invite_token` | varchar UK | UUID hex |
| `membership_status` | int | 1=Invited, 2=Active, 3=Completed, 4=Revoked, 5=Expired |
| `access_mode` | int | 1=Open, 2=Invitation, 3=AdminAssigned, 4=Imported |
| `progress_percent` | int | 0–100 |
| `enrolled_at` | datetime | |
| `completed_at` | datetime | |

**Admin actions:** View all enrollments, revoke access, manually assign learners to courses.

---

### `gamification_badge`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `name` | varchar | e.g. "Explorer" |
| `slug` | slug UK | |
| `description` | text | |
| `min_points` | int | Points threshold to earn this badge |
| `icon_asset_id` | int FK → Asset | |
| `sort_order` | int | Display order |
| `is_active` | bool | Disable without deleting |
| `created_at` | datetime | |

**Admin actions:** Create/edit/delete badges and set point thresholds.

---

### `gamification_userpointledger`

Append-only audit log of every point event.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `user_id` | int FK → User | |
| `source_type` | int | 1=Quiz, 2=CourseCompletion, 3=LessonCompletion, 4=AdminBonus, 5=BadgeBonus |
| `source_entity_id` | int FK → ContentEntity | Which course/quiz gave points |
| `source_attempt_id` | int FK → QuizAttempt | |
| `points` | int | Can be negative (deduction) |
| `reason` | varchar | Human-readable note |
| `created_at` | datetime | |

---

### `gamification_userbadge`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `user_id` | int FK → User | |
| `badge_id` | int FK → Badge | |
| `awarded_at` | datetime | |

Unique constraint: one badge per user per badge type.

---

## Admin Data Flow

```
Admin logs in  →  JWT token issued (accounts_user.role = 'admin')
         │
         ├─► Manage Users  →  accounts_user (CRUD)
         │
         ├─► Manage Categories  →  taxonomy_category (CRUD)
         │
         ├─► View / Manage Courses
         │     →  content_contententity (read all)
         │     →  content_coursesettings (update visibility/access)
         │
         ├─► Manage Enrollments
         │     →  enrollment_coursemembership (revoke / assign)
         │
         ├─► Manage Badges
         │     →  gamification_badge (CRUD)
         │     →  gamification_userbadge (view earned)
         │
         └─► View Reports
               →  enrollment_coursemembership (counts, progress)
               →  gamification_userpointledger (audit)
               →  reviews_coursereview (star ratings)
```
