# Instructor / Course Manager Testing Guide

This document assists in verifying the workflow for the **Instructor** role within the **Learnova (eLearning Platform)** backend API.

## Requirements Overview
- Creates, edits, publishes/unpublishes courses.
- Adds lessons (Video, Document, Image, Quiz) and manages "Allow Download" toggles.
- Supports S3 AWS backend storage for uploaded content.
- Adds Quizzes with attempt-based reward points.

## 1. Authentication
1. Provide credentials for an `instructor` via `POST /api/auth/login/`.
2. Extract the access token for the following endpoints.

## 2. Course Creation (A2 - Course Form)
- **Endpoint**: `POST /api/courses/`
- Create a course with properties such as `visibility` ("everyone" or "signed_in") and `access_rule` ("open", "invitation", "payment"). 
- Provide a `price` if the rule is "payment". 
- Add `tags` and `website` (required usually when published).

## 3. Lesson and Content Management (A3 & A4)
- **Create Module**: `POST /api/courses/{course_id}/modules/`
- **Create Lesson**: `POST /api/modules/{module_id}/lessons/`
  - In your request payload, set `content_type` to `video`, `document`, or `image`.
  - To fulfill the requirement for downloadable settings, toggle `allow_download` to `true` or `false`.
  - *Cloud Storage Verification*: When uploading files, observe that the models route standard media to Amazon S3 using the configured `boto3` parameters in `settings.py`.

## 4. Quiz Builder & Rewards (A7 - Quiz Builder)
- **Create Quiz**: `POST /api/quizzes/course/{course_id}/`
- Pass in parameters detailing reward points based on attempts: `reward_first_try`, `reward_second_try`, `reward_third_try`, `reward_fourth_plus`. 
- **Add Questions**: Nested arrays `questions` and `options` can be posted alongside the quiz creation, capturing `marks` and `is_correct` validation natively.

## 5. Publishing and Tracking (A8 - Reporting)
- **Publish**: `POST /api/courses/{pk}/publish/` toggles status from draft to published. 
- **Dashboard Overview**: `GET /api/courses/dashboard/instructor/`
- Validates the return of "In Progress", "Completed", and "Yet To Start" enrollment totals across all courses managed by this instructor.
