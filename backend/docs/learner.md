# Learner (User) Testing Guide

This document helps test and assure the **Learner** workflows match the PDF criteria for the **Learnova (eLearning Platform)**.

## Requirements Overview
- View published courses based on visibility rules.
- Enroll/Start lessons and manage progress.
- Attempts quizzes inside lessons with single question processing (simulated via attempt processing).
- Earns points, unlocks badges, and posts course reviews.

## 1. Authentication
- Register or login via `POST /api/auth/register/` and `POST /api/auth/login/` acting as a user with the `learner` role.

## 2. Browsing and Enrollment
- **Browse Published Courses**: `GET /api/courses/`
- Note which courses return based on visibility rules (`everyone` vs `signed_in`). Unauthenticated guests shouldn't receive `signed_in` courses in their response payload!
- **Enroll in Course**: `POST /api/courses/{course_id}/enroll/`
- Validates that the endpoint rejects enrollments if the course uses an `invitation` rule and they're uninvited.

## 3. Learner Profile, Points, and Badges
- **Dashboard**: `GET /api/courses/dashboard/learner/`
- Check `GET /api/auth/me/` which now exposes the user's `points` field and computes their `badge` (e.g., "Newbie" at 20, "Master" at 120 points).

## 4. Taking Quizzes & Reward Scaling (B6 & B7)
- **Submit Quiz**: `POST /api/quizzes/{quiz_id}/attempt/`
- Firing consecutive valid payloads to this endpoint increments the `attempt_number`.
- The database logic computes whether the score meets `pass_percentage`.
- **Validation**: On the first pass, `attempt.points_earned` will equal the quiz's `reward_first_try` configuration. The learner's `points` are immediately incremented. Subsequent passes do not double-reward past the initial success threshold. 

## 5. Progress Tracking
- **Complete Lesson**: `POST /api/courses/lessons/{lesson_id}/complete/`
- Firing this calculates the overall course `progress_percent`. Firing it for the final lesson will transition the `Enrollment` status to `completed` and stamp `completed_at`.

## 6. Ratings and Reviews
- **Add Review**: `POST /api/courses/{course_id}/reviews/`
- Passing a `rating` (1-5) and `review_text`.
- Call `GET /api/courses/{course_id}/` recursively and observe that the course detail response now nests the written reviews underneath the `reviews` array natively.
