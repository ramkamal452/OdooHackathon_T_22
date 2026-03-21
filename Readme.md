# Learnova — eLearning Platform

A responsive eLearning platform built for the Odoo Hackathon (Team 22).

## Overview

Learnova provides a complete learning experience with two sides:

- **Instructor / Admin (Backoffice)** — Create and manage courses, lessons, quizzes, attendees, publish courses, and track learner progress.
- **Learner (Website / App)** — Browse/join courses, learn in a full-screen player, attempt quizzes, earn points/badges, and post ratings/reviews.

## Key Features

- Course management with video, document, image, and quiz lessons
- Quiz builder with attempt-based point rewards
- Gamification — points and badge levels (Newbie → Master)
- Role-based access: Admin, Instructor, Learner
- Visibility & access rules (Everyone/Signed In, Open/Invitation/Payment)
- Learner progress tracking and reporting dashboard
- Ratings & reviews system

## Getting Started

### Prerequisites

- Docker & Docker Compose

### Setup

1. Clone the repo
2. Copy `.env.example` to `.env` and adjust credentials if needed
3. Start the database:

```bash
docker compose up -d
```

### MySQL Connection

| Variable             | Default              |
|----------------------|----------------------|
| `MYSQL_ROOT_PASSWORD`| `learnova_root_pass` |
| `MYSQL_DATABASE`     | `learnova`           |
| `MYSQL_USER`         | `learnova_user`      |
| `MYSQL_PASSWORD`     | `learnova_pass`      |
| `MYSQL_PORT`         | `3306`               |

## Team

Team 22 — Odoo Hackathon
