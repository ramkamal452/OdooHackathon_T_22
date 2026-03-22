# Instructor — Data Flow & Database Tables

> **Role:** `instructor` — can create and manage their own courses, content, modules, lessons, quizzes, and categories.

---

## Tables Used by Instructor

### Creating a Course

**Step 1: Create the root entity**

Table: `content_contententity`

| Column | Value set by instructor |
|---|---|
| `entity_type` | 1 (Course) |
| `title` | Course name |
| `short_description` | Tagline |
| `description` | Full description |
| `owner_id` | → logged-in instructor's `User.id` |
| `status_code` | 1 = Draft (default) |
| `thumbnail_asset_id` | Set after uploading a thumbnail |

**Step 2: Configure course settings**

Table: `content_coursesettings` (1-to-1 with ContentEntity where entity_type=COURSE)

| Column | Purpose |
|---|---|
| `visibility_code` | Who can see it (Everyone / Signed-in users) |
| `access_rule_code` | How to enroll (Open / Invitation / Payment) |
| `price` | If payment-gated |
| `level_code` | Beginner / Intermediate / Advanced |
| `website` | Optional external link |

**Step 3: Tag the course**

Table: `taxonomy_entitycategory` — links a ContentEntity to a `taxonomy_category`.
Table: `taxonomy_entitytag` — links a ContentEntity to a `taxonomy_tag`.

---

### Building Content (Modules → Lessons → Videos/Quizzes)

Every content node is a row in `content_contententity`.  
The tree structure is stored in `content_contentstructure`.

#### `content_contentstructure`

| Column | Notes |
|---|---|
| `parent_entity_id` | e.g., Course ID |
| `child_entity_id` | e.g., Module ID |
| `sort_order` | Position in parent's list |
| `is_required` | Affects course progress calculation |
| `is_preview` | Accessible without enrollment |
| `unlock_rule_code` | 1=Immediate, 2=AfterPrevious, etc. |

#### Type-specific detail tables

Each leaf content type has its own detail table (1-to-1 with ContentEntity):

| Detail table | entity_type | Key columns |
|---|---|---|
| `content_lessoncontent` | 3 (Lesson) | `body` (text), `lesson_format` |
| `content_videocontent` | 4 (Video) | `video_url`, `video_asset_id`, `duration_seconds`, `allow_download` |
| `content_quizcontent` | 5 (Quiz) | `pass_percentage`, `attempt_limit`, `shuffle_questions`, `award_points` |
| `content_articlecontent` | 6 (Article) | `body_markdown`, `reading_time_seconds` |
| `content_resourcecontent` | 7 (Resource) | `resource_url`, `asset_id`, `resource_kind`, `allow_download` |

---

### Uploading Files (Videos, PDFs, Images)

Table: `assets_asset`

| Column | Notes |
|---|---|
| `object_key` | S3 key or local path (unique) |
| `file_name` | Original filename |
| `mime_type` | e.g. `video/mp4` |
| `file_size_bytes` | |
| `storage_provider` | 1=S3, 2=CloudFront, 3=Local |
| `is_public` | Public URL accessible |
| `uploaded_by_id` | → instructor's User.id |

Assets are referenced from VideoContent, ResourceContent, ContentAttachment, and ContentEntity (thumbnail).

---

### Attaching Files to Lessons/Videos/Courses

Table: `content_contentattachment`

| Column | Notes |
|---|---|
| `entity_id` | Any ContentEntity |
| `title` | Display name |
| `asset_id` | → uploaded Asset |
| `external_url` | Alternative to asset |
| `sort_order` | |

---

### Creating Quiz Questions

Table: `quizzes_quizquestion`

| Column | Notes |
|---|---|
| `quiz_entity_id` | → ContentEntity with entity_type=5 |
| `question_type` | 1=MCQ_Single, 2=MCQ_Multiple, 3=ShortText, 4=TrueFalse |
| `question_text` | |
| `marks` | Points per question |
| `sort_order` | |

Table: `quizzes_quizoption`

| Column | Notes |
|---|---|
| `question_id` | → QuizQuestion |
| `option_text` | |
| `is_correct` | Correct answer flag |
| `sort_order` | |

---

### Setting Point Rewards per Quiz

Table: `quizzes_quizrewardrule`

| Column | Notes |
|---|---|
| `quiz_entity_id` | → ContentEntity (Quiz) |
| `attempt_from` | Attempt number range start (e.g., 1) |
| `attempt_to` | Range end (null = unlimited) |
| `points_awarded` | Points given if passed on this attempt range |

_Example:_ 1st attempt → 10 pts, 2nd attempt → 8 pts, 3rd+ → 5 pts.

---

### Publishing the Course

Instructor sets `status_code = 2` (Published) on the ContentEntity row for the course:
- Sets `published_at` timestamp
- Makes course visible per `visibility_code`
- Learners can now enroll based on `access_rule_code`

---

## Instructor Data Flow

```
Instructor logs in  →  JWT issued (accounts_user.role = 'instructor')
        │
        ├─► Create Course
        │     →  content_contententity  (INSERT, entity_type=1)
        │     →  content_coursesettings (INSERT 1-to-1)
        │
        ├─► Add Modules / Lessons / Videos
        │     →  content_contententity  (INSERT per node)
        │     →  content_contentstructure (INSERT parent→child link)
        │     →  content_lessoncontent / content_videocontent / etc.
        │
        ├─► Upload Files
        │     →  assets_asset (INSERT)
        │     →  content_videocontent.video_asset_id (UPDATE)
        │
        ├─► Create Quiz
        │     →  content_contententity  (entity_type=5)
        │     →  content_quizcontent
        │     →  quizzes_quizquestion   (N rows)
        │     →  quizzes_quizoption     (N×options rows)
        │     →  quizzes_quizrewardrule (optional)
        │
        ├─► Categorize Course
        │     →  taxonomy_entitycategory (INSERT)
        │
        └─► Publish
              →  content_contententity.status_code = 2
              →  content_contententity.published_at = NOW()
```
