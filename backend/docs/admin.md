# Admin Testing Guide

This guide details how to verify that the **Learnova (eLearning Platform)** requirements for specifically the **Admin** role have been correctly met by the backend implementation. 

## Requirements Overview
- Full access to back-office features.
- Can manage all courses, reporting, and settings.
- Can create and edit courses acting as the super instructor.

## 1. Authentication and Setup
1. Use the login endpoint (`POST /api/auth/login/`) with an Admin's credentials.
2. Ensure you receive the JWT token.
3. Attach this token as a Bearer Token in your HTTP request headers for all subsequent steps.

## 2. Managing Users & Roles
- **Endpoint**: `GET /api/auth/users/`
- Verify that Admins can list all users, view their `role` (Admin, Instructor, Learner), as well as their `points` and `badge` status.

## 3. Creating & Managing All Courses
*Since Admins have super-instructor capabilities, they have unrestricted access to all endpoints Instructors use, but apply across the entire platform.*
- **Endpoint**: `POST /api/courses/`
- Create a course. Observe that the Admin user is automatically captured as the `instructor` (Course Admin).
- Note that fields like `tags` and `website` correctly process data.

## 4. Backoffice Dashboards and Reporting
**Course Master List**
- **Endpoint**: `GET /api/admin/courses/`
- Testing the Kanban/List requirement. The API returns all courses in the system, returning fields like `lesson_count`, `duration_minutes`, and `status` (published).

**Enrollments Reporting**
- **Endpoint**: `GET /api/admin/enrollments/`
- Check that the returned data includes `time_spent_seconds` and the updated statuses: `yet_to_start`, `in_progress`, and `completed`.

**Detailed Progress Tracking**
- **Endpoint**: `GET /api/admin/lesson-progress/`
- Verify you can filter progress down to individual users and lessons, satisfying the requirement to see accurate "Completed" timestamps and statuses.

## 5. Storage Checks
- For any image or video uploads via lessons or course thumbnails, confirm the API utilizes the uploaded resources and proxies securely generated AWS S3 URLs.
