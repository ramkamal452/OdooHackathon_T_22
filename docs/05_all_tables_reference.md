# All Database Tables — Quick Reference

> Every table in the Learnova platform, listed with their Django app, model name, Django table name, and purpose.

---

## accounts app

| Model | DB Table | Purpose |
|---|---|---|
| `User` | `accounts_user` | All platform users (admin, instructor, learner). Email-based login. Stores role, points (gamification score), bio, avatar. |

---

## assets app

| Model | DB Table | Purpose |
|---|---|---|
| `Asset` | `assets_asset` | File record for every uploaded file (video, PDF, image, etc.). Stores S3 key, bucket, file size, MIME type, and uploader. |

---

## taxonomy app

| Model | DB Table | Purpose |
|---|---|---|
| `Category` | `taxonomy_category` | Course categories. Self-referential (parent → child sub-categories). Slug auto-generated. |
| `Tag` | `taxonomy_tag` | Free-form tags. Slug auto-generated. |
| `EntityCategory` | `taxonomy_entitycategory` | Many-to-many join: ContentEntity ↔ Category |
| `EntityTag` | `taxonomy_entitytag` | Many-to-many join: ContentEntity ↔ Tag |

---

## content app

| Model | DB Table | Purpose |
|---|---|---|
| `ContentEntity` | `content_contententity` | **Core table.** One row for every piece of content (course, module, lesson, video, quiz, article, resource). Soft-deletes via `deleted_at`. |
| `ContentStructure` | `content_contentstructure` | Parent-child relationships between content entities. Controls sort order, unlock rules, and preview access. |
| `CourseSettings` | `content_coursesettings` | Course-specific settings (visibility, access mode, price, level). 1-to-1 with ContentEntity (type=Course). |
| `VideoContent` | `content_videocontent` | Video metadata: URL, streaming provider, duration, captions, allow-download. 1-to-1 with ContentEntity (type=Video). |
| `ArticleContent` | `content_articlecontent` | Article body (Markdown) and reading time estimate. 1-to-1 with ContentEntity (type=Article). |
| `ResourceContent` | `content_resourcecontent` | Downloadable resource: URL or asset reference, resource kind (PDF/image/etc.). 1-to-1 with ContentEntity (type=Resource). |
| `LessonContent` | `content_lessoncontent` | Lesson body text and format. 1-to-1 with ContentEntity (type=Lesson). |
| `QuizContent` | `content_quizcontent` | Quiz configuration: pass %, attempt limit, shuffle settings, time limit. 1-to-1 with ContentEntity (type=Quiz). |
| `EntityStats` | `content_entitystats` | Precomputed stats: enrollment count, avg rating, completion count, total duration. Updated on write events. |
| `CompletionRule` | `content_completionrule` | Rules that determine when an entity is considered "complete" (e.g., all children done, quiz passed). |
| `EntityPrerequisite` | `content_entityprerequisite` | Entity A requires Entity B to be completed before unlocking. |
| `ContentAttachment` | `content_contentattachment` | Downloadable files or external links attached to any entity. |

---

## quizzes app

| Model | DB Table | Purpose |
|---|---|---|
| `QuizQuestion` | `quizzes_quizquestion` | Questions belonging to a quiz entity. Supports MCQ single/multiple, true/false, short text. |
| `QuizOption` | `quizzes_quizoption` | Answer options for MCQ questions. `is_correct` flag. |
| `QuizAttempt` | `quizzes_quizattempt` | One row per learner per quiz attempt. Records score, percentage, pass status, time spent. |
| `QuizAttemptAnswer` | `quizzes_quizattemptanswer` | Per-question answers within an attempt. Records selected option, correctness, marks awarded. |
| `QuizRewardRule` | `quizzes_quizrewardrule` | Point rewards per attempt range (e.g., 1st attempt = 10 pts, 2nd = 8 pts). |

---

## enrollment app

| Model | DB Table | Purpose |
|---|---|---|
| `CourseMembership` | `enrollment_coursemembership` | Links a user to a course. Tracks enrollment status, progress %, time spent, access mode. |
| `EntityProgress` | `enrollment_entityprogress` | Per-entity completion tracking for each learner. One row per (learner, entity) pair. |

---

## gamification app

| Model | DB Table | Purpose |
|---|---|---|
| `Badge` | `gamification_badge` | Badge definitions with point thresholds. Admin-managed. |
| `UserBadge` | `gamification_userbadge` | Records which badges a user has earned. Unique per (user, badge). |
| `UserPointLedger` | `gamification_userpointledger` | Append-only log of every point gain/deduction. Source can be a quiz, course completion, or admin bonus. |

---

## reviews app

| Model | DB Table | Purpose |
|---|---|---|
| `CourseReview` | `reviews_coursereview` | Star rating + text review per learner per course. One review max per learner per course. |

---

## Django Built-in Tables (also present in DB)

| Table | Purpose |
|---|---|
| `auth_permission` | Django permissions |
| `django_content_type` | Generic FK support |
| `django_migrations` | Migration state |
| `django_session` | Session storage (if using session auth) |
| `token_blacklist_*` | JWT token blacklist (Simple JWT) |

---

## Enum Reference

### `entity_type` (content_contententity)
| Value | Label |
|---|---|
| 1 | Course |
| 2 | Module |
| 3 | Lesson |
| 4 | Video |
| 5 | Quiz |
| 6 | Article |
| 7 | Resource |

### `status_code` (content_contententity)
| Value | Label |
|---|---|
| 1 | Draft |
| 2 | Published |
| 3 | Archived |
| 4 | Hidden |

### `membership_status` (enrollment_coursemembership)
| Value | Label |
|---|---|
| 1 | Invited |
| 2 | Active |
| 3 | Completed |
| 4 | Revoked |
| 5 | Expired |

### `progress_status` (enrollment_entityprogress)
| Value | Label |
|---|---|
| 1 | Not started |
| 2 | In progress |
| 3 | Completed |
| 4 | Failed |
| 5 | Locked |

### `source_type` (gamification_userpointledger)
| Value | Label |
|---|---|
| 1 | Quiz |
| 2 | Course completion |
| 3 | Lesson completion |
| 4 | Admin bonus |
| 5 | Badge bonus |
