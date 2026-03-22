# Learnova Documentation Index

Welcome to the Learnova eLearning Platform database and architecture documentation.

---

## Files in this folder

| File | Contents |
|---|---|
| [01_database_overview.md](./01_database_overview.md) | Full ER diagram (Mermaid), content hierarchy tree, and key design decisions |
| [02_admin_data_flow.md](./02_admin_data_flow.md) | All tables and step-by-step data flow from the **Admin** perspective |
| [03_instructor_data_flow.md](./03_instructor_data_flow.md) | All tables and step-by-step data flow from the **Instructor** perspective |
| [04_learner_data_flow.md](./04_learner_data_flow.md) | All tables and step-by-step data flow from the **Learner** perspective |
| [05_all_tables_reference.md](./05_all_tables_reference.md) | Quick reference — every DB table and enum value in one place |

---

## Quick Summary

```
accounts_user          ← All users (admin / instructor / learner)
  │
  ├─► owns ──────────► content_contententity  (courses, modules, lessons, videos, quizzes, resources)
  │                         └── content_contentstructure  (parent→child tree)
  │                         └── content_coursesettings   (course-level config)
  │                         └── [type-specific detail table]
  │                         └── content_contentattachment
  │
  ├─► enrolls in ────► enrollment_coursemembership  (progress %, status)
  │                         └── enrollment_entityprogress  (per-lesson completion)
  │
  ├─► attempts ──────► quizzes_quizattempt
  │                         └── quizzes_quizattemptanswer
  │
  ├─► earns ─────────► gamification_userpointledger  (audit log)
  │                         └── gamification_userbadge  (awarded badges)
  │
  └─► reviews ───────► reviews_coursereview
```

---

## Technology Stack

- **Database:** MySQL (via Docker)
- **ORM:** Django ORM — no raw SQL used in application code
- **Auth:** JWT (Simple JWT) — tokens stored/blacklisted in `token_blacklist_*` tables
- **File storage:** Amazon S3 (production) / local media (development), tracked in `assets_asset`
- **Background jobs:** None — badge checks run synchronously on every point award
