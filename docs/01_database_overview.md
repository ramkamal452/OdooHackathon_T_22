# Learnova — Database Architecture Overview

> All data is handled within **Django's ORM** (MySQL via Docker). There are no external databases.
> Every table below corresponds to a Django model. Primary keys are always auto-increment integers unless stated otherwise.

---

## Apps & Their Responsibility

| App | Purpose |
|---|---|
| `accounts` | Users, authentication, roles |
| `assets` | File storage records (S3 / local) |
| `taxonomy` | Categories and tags |
| `content` | All course content (courses, modules, lessons, videos, quizzes, resources) |
| `quizzes` | Quiz questions, options, attempts, answers |
| `enrollment` | Course memberships and learner progress |
| `gamification` | Badges and point ledger |
| `reviews` | Course star ratings and text reviews |

---

## Entity-Relationship Overview

```mermaid
erDiagram
    User {
        int id PK
        string email UK
        string role
        string first_name
        string last_name
        string bio
        image avatar
        int points
        datetime last_login_at
    }

    Asset {
        int id PK
        string object_key UK
        string file_name
        string mime_type
        int storage_provider
        int file_size_bytes
        bool is_public
        int uploaded_by FK
    }

    Category {
        int id PK
        string name
        string slug UK
        int parent FK
        datetime created_at
    }

    Tag {
        int id PK
        string name
        string slug UK
        datetime created_at
    }

    ContentEntity {
        int id PK
        int entity_type
        string title
        string slug UK
        string short_description
        text description
        int owner FK
        int status_code
        int thumbnail_asset FK
        int estimated_duration_seconds
        bool allow_standalone_enrollment
        bool is_reusable
        datetime published_at
        datetime created_at
        datetime deleted_at
    }

    ContentStructure {
        int id PK
        int parent_entity FK
        int child_entity FK
        int sort_order
        bool is_required
        bool is_preview
        int unlock_rule_code
    }

    CourseSettings {
        int entity_id PK_FK
        int visibility_code
        int access_rule_code
        decimal price
        string website
        int responsible FK
        int level_code
    }

    VideoContent {
        int entity_id PK_FK
        int video_asset FK
        string video_url
        int duration_seconds
        bool allow_download
    }

    ArticleContent {
        int entity_id PK_FK
        text body_markdown
        int reading_time_seconds
    }

    ResourceContent {
        int entity_id PK_FK
        int asset FK
        string resource_url
        int resource_kind
        bool allow_download
    }

    LessonContent {
        int entity_id PK_FK
        int lesson_format
        text body
    }

    QuizContent {
        int entity_id PK_FK
        int pass_percentage
        int attempt_limit
        bool shuffle_questions
        bool award_points
    }

    EntityStats {
        int entity_id PK_FK
        int direct_child_count
        int enrollment_count
        int completion_count
        decimal average_rating
    }

    EntityCategory {
        int id PK
        int entity FK
        int category FK
    }

    EntityTag {
        int id PK
        int entity FK
        int tag FK
    }

    ContentAttachment {
        int id PK
        int entity FK
        string title
        int asset FK
        string external_url
        int sort_order
    }

    CompletionRule {
        int id PK
        int entity FK
        int rule_type
        json rule_config
    }

    EntityPrerequisite {
        int id PK
        int entity FK
        int required_entity FK
    }

    QuizQuestion {
        int id PK
        int quiz_entity FK
        int question_type
        text question_text
        int marks
        int sort_order
    }

    QuizOption {
        int id PK
        int question FK
        string option_text
        bool is_correct
    }

    QuizAttempt {
        int id PK
        int quiz_entity FK
        int learner FK
        int attempt_no
        int score
        decimal percentage
        bool is_passed
        int points_earned
        datetime submitted_at
    }

    QuizAttemptAnswer {
        int id PK
        int attempt FK
        int question FK
        int selected_option FK
        bool is_correct
        int marks_awarded
    }

    QuizRewardRule {
        int id PK
        int quiz_entity FK
        int attempt_from
        int attempt_to
        int points_awarded
    }

    CourseMembership {
        int id PK
        int course_entity FK
        int user FK
        string invited_email
        int membership_status
        int access_mode
        int progress_percent
        datetime enrolled_at
        datetime completed_at
    }

    EntityProgress {
        int id PK
        int learner FK
        int entity FK
        int progress_status
        int progress_percent
        datetime completed_at
    }

    Badge {
        int id PK
        string name
        string slug UK
        int min_points
        int icon_asset FK
        bool is_active
    }

    UserBadge {
        int id PK
        int user FK
        int badge FK
        datetime awarded_at
    }

    UserPointLedger {
        int id PK
        int user FK
        int source_type
        int source_entity FK
        int source_attempt FK
        int points
        string reason
        datetime created_at
    }

    CourseReview {
        int id PK
        int course_entity FK
        int user FK
        int rating
        text review_text
        bool is_published
        datetime created_at
    }

    User ||--o{ ContentEntity : "owns (owner)"
    User ||--o{ CourseSettings : "responsible_for"
    User ||--o{ CourseMembership : "enrolled_in"
    User ||--o{ EntityProgress : "tracks"
    User ||--o{ QuizAttempt : "attempts"
    User ||--o{ UserBadge : "earns"
    User ||--o{ UserPointLedger : "earns_points"
    User ||--o{ CourseReview : "writes"
    User ||--o{ Asset : "uploads"

    ContentEntity ||--o{ ContentStructure : "parent_of"
    ContentEntity ||--o{ ContentStructure : "child_of"
    ContentEntity |o--|| CourseSettings : "has_settings"
    ContentEntity |o--|| VideoContent : "has_video"
    ContentEntity |o--|| ArticleContent : "has_article"
    ContentEntity |o--|| ResourceContent : "has_resource"
    ContentEntity |o--|| LessonContent : "has_lesson"
    ContentEntity |o--|| QuizContent : "has_quiz"
    ContentEntity |o--|| EntityStats : "has_stats"
    ContentEntity ||--o{ EntityCategory : "tagged_with_category"
    ContentEntity ||--o{ EntityTag : "tagged_with_tag"
    ContentEntity ||--o{ ContentAttachment : "has_attachments"
    ContentEntity ||--o{ CompletionRule : "has_rules"
    ContentEntity ||--o{ EntityPrerequisite : "requires"
    ContentEntity ||--o{ QuizQuestion : "has_questions"
    ContentEntity ||--o{ QuizAttempt : "attempted_on"
    ContentEntity ||--o{ CourseMembership : "has_members"
    ContentEntity ||--o{ EntityProgress : "progress_tracked"
    ContentEntity ||--o{ CourseReview : "reviewed_on"
    ContentEntity ||--o{ UserPointLedger : "source"

    Category ||--o{ EntityCategory : "categorizes"
    Category ||--o{ Category : "parent_of"
    Tag ||--o{ EntityTag : "tags"

    QuizQuestion ||--o{ QuizOption : "has_options"
    QuizAttempt ||--o{ QuizAttemptAnswer : "has_answers"
    QuizAttemptAnswer }o--|| QuizOption : "selected"
    QuizAttemptAnswer }o--|| QuizQuestion : "answers"

    Badge ||--o{ UserBadge : "awarded_to"
    Asset ||--o{ ContentEntity : "thumbnail"
    Asset ||--o{ Badge : "icon"
```

---

## Content Hierarchy (Entity Tree)

```
Course  (entity_type=1)
  └── Module  (entity_type=2)          [via ContentStructure]
        └── Lesson  (entity_type=3)    [via ContentStructure]
              ├── Video  (entity_type=4)
              ├── Quiz   (entity_type=5)
              ├── Article (entity_type=6)
              └── Resource (entity_type=7)
```

All relationships between content nodes are stored in `content_contentstructure`.  
Each node can have multiple children; the order is controlled by `sort_order`.

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| Single `ContentEntity` table for all content types | Uniform slug, ownership, status, and hierarchy handling |
| Per-type detail tables (`VideoContent`, `QuizContent`, etc.) | Normalised — only relevant columns stored per type |
| `ContentStructure` junction table | Allows re-use of content nodes across multiple parents (`is_reusable`) |
| `EntityStats` cached table | Avoids expensive COUNT/AVG queries at read time |
| `CourseMembership` + `EntityProgress` split | Membership tracks enrollment state; progress tracks completion per entity node |
| `UserPointLedger` as append-only ledger | Full audit trail of all point events |
| `Badge` auto-check on every point award | Ensures badges are never missed without a background job |
