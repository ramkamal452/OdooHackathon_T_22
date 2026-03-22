import random
import string
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from content.models import (
    ContentEntity, ContentStructure, CourseSettings, EntityStats,
    EntityType, StatusCode, LessonContent, LessonFormat, VideoContent,
    ResourceContent, ResourceKind, ArticleContent, QuizContent,
    VisibilityCode, AccessRuleCode, LevelCode, UnlockRuleCode,
)
from taxonomy.models import Category, Tag, EntityCategory, EntityTag
from quizzes.models import QuizQuestion, QuizOption, QuizRewardRule


CATEGORIES = [
    ("Programming", [
        "Python", "JavaScript", "Java", "C++", "Rust", "Go", "TypeScript",
        "Ruby", "Swift", "Kotlin", "PHP", "Scala",
    ]),
    ("Web Development", [
        "React", "Angular", "Vue.js", "Next.js", "Django", "Flask",
        "Node.js", "Express.js", "Svelte", "Tailwind CSS",
    ]),
    ("Data Science", [
        "Machine Learning", "Deep Learning", "NLP", "Computer Vision",
        "Statistics", "Pandas", "TensorFlow", "PyTorch", "Data Visualization",
    ]),
    ("DevOps & Cloud", [
        "Docker", "Kubernetes", "AWS", "Azure", "GCP", "CI/CD", "Terraform",
        "Ansible", "Linux Administration",
    ]),
    ("Mobile Development", [
        "iOS Development", "Android Development", "React Native", "Flutter",
        "SwiftUI", "Jetpack Compose",
    ]),
    ("Cybersecurity", [
        "Ethical Hacking", "Network Security", "Cryptography",
        "Penetration Testing", "Security Auditing", "OWASP Top 10",
    ]),
    ("Design", [
        "UI/UX Design", "Figma", "Adobe Photoshop", "Illustration",
        "Motion Graphics", "Brand Identity",
    ]),
    ("Business", [
        "Digital Marketing", "SEO", "Financial Analysis", "Project Management",
        "Agile & Scrum", "Business Strategy", "Entrepreneurship",
    ]),
    ("Mathematics", [
        "Linear Algebra", "Calculus", "Discrete Mathematics",
        "Probability Theory", "Number Theory", "Graph Theory",
    ]),
    ("Science", [
        "Physics Fundamentals", "Organic Chemistry", "Molecular Biology",
        "Astronomy", "Environmental Science",
    ]),
    ("Creative Arts", [
        "Creative Writing", "Music Theory", "Photography",
        "Video Production", "Podcasting", "3D Modeling",
    ]),
    ("Personal Growth", [
        "Public Speaking", "Leadership", "Productivity",
        "Critical Thinking", "Emotional Intelligence", "Time Management",
    ]),
]

TAGS = [
    "beginner-friendly", "hands-on", "project-based", "certification",
    "self-paced", "live-sessions", "free", "premium", "popular",
    "new-release", "trending", "community", "mentorship", "career",
    "practical", "theory", "exam-prep", "workshop", "bootcamp",
    "short-course", "deep-dive", "refresher", "masterclass",
    "industry", "academic", "open-source", "case-study",
]

INSTRUCTORS = [
    ("Sarah", "Chen", "sarah.chen@learnova.dev"),
    ("James", "Rodriguez", "james.rod@learnova.dev"),
    ("Priya", "Sharma", "priya.sharma@learnova.dev"),
    ("Michael", "Foster", "michael.f@learnova.dev"),
    ("Aisha", "Ibrahim", "aisha.i@learnova.dev"),
    ("David", "Kim", "david.kim@learnova.dev"),
    ("Elena", "Volkov", "elena.v@learnova.dev"),
    ("Carlos", "Mendez", "carlos.m@learnova.dev"),
    ("Yuki", "Tanaka", "yuki.t@learnova.dev"),
    ("Oliver", "Brown", "oliver.b@learnova.dev"),
]

LEARNERS = [
    ("Alice", "Johnson", "alice.j@test.com"),
    ("Bob", "Smith", "bob.smith@test.com"),
    ("Carol", "Williams", "carol.w@test.com"),
    ("Dan", "Miller", "dan.m@test.com"),
    ("Eve", "Davis", "eve.d@test.com"),
]

VIDEO_URLS = [
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/jNQXAC9IVRw",
    "https://www.youtube.com/embed/9bZkp7q19f0",
    "https://www.youtube.com/embed/kJQP7kiw5Fk",
    "https://www.youtube.com/embed/RgKAFK5djSk",
]

COURSE_TEMPLATES = {
    "Programming": {
        "prefixes": [
            "Complete {topic} Bootcamp", "Mastering {topic}", "{topic} from Zero to Hero",
            "The Ultimate {topic} Course", "Learn {topic} by Building Projects",
            "{topic} for Absolute Beginners", "Advanced {topic} Techniques",
            "Professional {topic} Development", "{topic} Design Patterns & Best Practices",
            "{topic}: Build Real-World Applications",
        ],
        "descriptions": [
            "Master {topic} through hands-on projects and real-world examples. Build a strong foundation from variables and data types to advanced concepts like concurrency and design patterns.",
            "A comprehensive guide to {topic} covering everything from syntax basics to production-ready code. Includes 50+ coding exercises and 10 mini-projects.",
            "Learn {topic} the practical way. This course emphasizes writing clean, maintainable code with industry best practices. Perfect for career changers and self-taught developers.",
        ],
        "module_templates": [
            "Getting Started with {topic}",
            "{topic} Fundamentals",
            "Data Structures in {topic}",
            "Object-Oriented {topic}",
            "Error Handling & Debugging",
            "Working with APIs",
            "Testing in {topic}",
            "Advanced {topic} Patterns",
            "Performance Optimization",
            "Deployment & Production",
            "Concurrency & Parallelism",
            "Package Management",
        ],
    },
    "Web Development": {
        "prefixes": [
            "Build Modern Apps with {topic}", "Full-Stack {topic} Development",
            "{topic} Crash Course", "{topic}: From Prototype to Production",
            "The Complete {topic} Guide", "Enterprise {topic} Applications",
            "Responsive Web Design with {topic}", "Server-Side Rendering with {topic}",
            "{topic} Performance & Optimization", "{topic} State Management Deep Dive",
        ],
        "descriptions": [
            "Build blazing-fast web applications with {topic}. Cover routing, state management, authentication, and deployment in this project-driven course.",
            "From component architecture to deployment pipelines — master {topic} with real-world projects. Includes REST API integration, testing, and CI/CD setup.",
            "Comprehensive {topic} training covering everything a professional web developer needs. Build 5 complete projects from scratch.",
        ],
        "module_templates": [
            "Setting Up Your {topic} Environment",
            "Component Architecture",
            "State Management",
            "Routing & Navigation",
            "Working with APIs & Data",
            "Authentication & Authorization",
            "Styling & Responsive Design",
            "Testing & Quality Assurance",
            "Performance Optimization",
            "Deployment Strategies",
            "Advanced Patterns",
        ],
    },
    "Data Science": {
        "prefixes": [
            "{topic} Masterclass", "Practical {topic}", "{topic} for Data Scientists",
            "Applied {topic}", "{topic} with Python", "Introduction to {topic}",
            "{topic}: Theory & Practice", "Hands-On {topic} Projects",
            "{topic} A-Z", "Real-World {topic} Applications",
        ],
        "descriptions": [
            "Unlock the power of {topic} with this comprehensive course. From mathematical foundations to implementing cutting-edge algorithms, you will gain both theoretical understanding and practical skills.",
            "Master {topic} through 20+ real-world datasets and projects. Learn to clean, analyze, model, and visualize data effectively.",
            "Industry-focused {topic} training covering the latest techniques used at top tech companies. Build an impressive portfolio along the way.",
        ],
        "module_templates": [
            "Introduction & Setup",
            "Mathematical Foundations",
            "Data Preprocessing",
            "Exploratory Data Analysis",
            "Core Algorithms",
            "Model Training & Evaluation",
            "Feature Engineering",
            "Hyperparameter Tuning",
            "Advanced Techniques",
            "Real-World Projects",
            "Ethics & Bias in AI",
        ],
    },
    "DevOps & Cloud": {
        "prefixes": [
            "{topic} Essentials", "Mastering {topic}", "{topic} in Practice",
            "{topic} for DevOps Engineers", "Production-Ready {topic}",
            "{topic} from Beginner to Expert", "Hands-On {topic}",
            "{topic} Architecture & Design", "Enterprise {topic} Solutions",
        ],
        "descriptions": [
            "Learn {topic} from the ground up with practical, hands-on labs. Deploy real infrastructure and build production-grade pipelines.",
            "A comprehensive guide to {topic} covering architecture decisions, security best practices, cost optimization, and monitoring.",
            "Master {topic} with real-world scenarios covering high availability, disaster recovery, and scalable system design.",
        ],
        "module_templates": [
            "Introduction to {topic}",
            "Core Concepts",
            "Networking & Security",
            "Storage & Databases",
            "Compute & Scaling",
            "Monitoring & Logging",
            "Automation & IaC",
            "CI/CD Pipelines",
            "Security & Compliance",
            "Cost Optimization",
            "Troubleshooting",
        ],
    },
}

DEFAULT_TEMPLATE = {
    "prefixes": [
        "Complete {topic} Course", "Mastering {topic}", "Introduction to {topic}",
        "{topic} Fundamentals", "The {topic} Handbook", "Professional {topic}",
        "{topic} for Everyone", "Applied {topic}", "{topic}: A Practical Guide",
        "Essential {topic} Skills",
    ],
    "descriptions": [
        "A thorough exploration of {topic} designed for all skill levels. Build practical skills through guided projects, quizzes, and real-world case studies.",
        "Master {topic} with structured lessons, interactive quizzes, and hands-on projects. Perfect for both beginners and professionals seeking to deepen their expertise.",
        "Learn the essential concepts and advanced techniques of {topic}. This course combines theory with practical application for maximum retention.",
    ],
    "module_templates": [
        "Introduction to {topic}",
        "Core Concepts",
        "Intermediate Techniques",
        "Advanced Applications",
        "Practical Projects",
        "Assessment & Review",
        "Case Studies",
        "Industry Best Practices",
    ],
}

LESSON_TITLES = {
    "video": [
        "Video Lecture: {mod_topic}",
        "Walkthrough: {mod_topic} in Action",
        "Demo: Building with {mod_topic}",
        "Tutorial: {mod_topic} Step by Step",
        "Live Coding: {mod_topic}",
        "Visual Guide to {mod_topic}",
    ],
    "article": [
        "Reading: {mod_topic} Explained",
        "Article: Deep Dive into {mod_topic}",
        "Guide: Understanding {mod_topic}",
        "Reference: {mod_topic} Cheat Sheet",
        "Notes: Key Concepts in {mod_topic}",
    ],
    "lesson_text": [
        "Lesson: {mod_topic}",
        "Theory: {mod_topic} Principles",
        "Concepts: {mod_topic}",
        "Study Material: {mod_topic}",
        "Overview: {mod_topic}",
    ],
    "resource": [
        "Downloadable: {mod_topic} Workbook",
        "Resource: {mod_topic} Reference Card",
        "Cheat Sheet: {mod_topic}",
        "Template: {mod_topic} Starter Kit",
        "Slides: {mod_topic} Presentation",
    ],
}

QUIZ_BANKS = {
    "Programming": [
        ("What is the output of: print(type([]))?", ["<class 'list'>", "<class 'array'>", "<class 'tuple'>", "<class 'set'>"], 0),
        ("Which keyword is used to define a function?", ["function", "def", "func", "define"], 1),
        ("What does OOP stand for?", ["Object-Oriented Programming", "Open Online Platform", "Ordered Operations Process", "Output Optimization Protocol"], 0),
        ("Which data structure uses FIFO?", ["Stack", "Queue", "Tree", "Graph"], 1),
        ("What is a closure?", ["A function with its own scope", "A class method", "A loop construct", "A file operation"], 0),
        ("What is Big O notation used for?", ["Algorithm complexity", "Variable naming", "File formatting", "Network protocols"], 0),
        ("Which is NOT a primitive data type?", ["Integer", "String", "Array", "Boolean"], 2),
        ("What is recursion?", ["A function calling itself", "A loop type", "A class hierarchy", "An error type"], 0),
        ("What does API stand for?", ["Application Programming Interface", "Automated Process Integration", "Advanced Protocol Implementation", "Applied Programming Instruction"], 0),
        ("What is polymorphism?", ["Objects taking many forms", "Single inheritance", "Variable scoping", "Memory management"], 0),
    ],
    "Web Development": [
        ("What does HTML stand for?", ["HyperText Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyper Transfer Markup Language"], 0),
        ("Which CSS property changes text color?", ["color", "text-color", "font-color", "text-style"], 0),
        ("What is the virtual DOM?", ["A lightweight copy of the real DOM", "A server-side DOM", "A database", "A CSS framework"], 0),
        ("Which HTTP method is used to create resources?", ["GET", "POST", "DELETE", "HEAD"], 1),
        ("What does REST stand for?", ["Representational State Transfer", "Remote Execution Standard Technology", "Rapid Enterprise Service Tool", "Resource Extended Service Template"], 0),
        ("What is CORS?", ["Cross-Origin Resource Sharing", "Client Object Request System", "Code Optimization Resource Service", "Cross-Origin Redirect Standard"], 0),
        ("Which status code means 'Not Found'?", ["401", "403", "404", "500"], 2),
        ("What is SSR?", ["Server-Side Rendering", "Single Source Repository", "Secure Socket Relay", "System State Recovery"], 0),
        ("What does JWT stand for?", ["JSON Web Token", "Java Web Tool", "JavaScript Widget Template", "Joint Wireless Technology"], 0),
        ("What is a CDN?", ["Content Delivery Network", "Central Database Node", "Code Distribution Network", "Client Data Namespace"], 0),
    ],
    "Data Science": [
        ("What is a DataFrame?", ["A 2D labeled data structure", "A chart type", "A database table", "An algorithm"], 0),
        ("Which is a supervised learning algorithm?", ["Linear Regression", "K-Means Clustering", "PCA", "Autoencoders"], 0),
        ("What does EDA stand for?", ["Exploratory Data Analysis", "Enhanced Data Algorithm", "External Data Access", "Estimated Data Accuracy"], 0),
        ("What is overfitting?", ["Model memorizes training data", "Model is too simple", "Model runs slowly", "Model uses too little data"], 0),
        ("Which metric is used for classification?", ["Accuracy", "RMSE", "R-squared", "MAE"], 0),
        ("What is feature engineering?", ["Creating new input features", "Building software features", "Testing code features", "Designing UI features"], 0),
        ("What is a confusion matrix?", ["A table showing prediction results", "A random matrix", "A data type", "A neural network layer"], 0),
        ("What does NLP stand for?", ["Natural Language Processing", "Network Layer Protocol", "Node Link Parser", "Numeric Logic Processing"], 0),
        ("What is gradient descent?", ["An optimization algorithm", "A sorting algorithm", "A search algorithm", "A hashing algorithm"], 0),
        ("What is cross-validation?", ["Evaluating model on different data splits", "Validating two models", "Cross-checking databases", "Verifying user credentials"], 0),
    ],
}

DEFAULT_QUIZ_BANK = [
    ("What is the main benefit of structured learning?", ["Better retention", "Faster internet", "More storage", "Less cost"], 0),
    ("Which study technique is most effective?", ["Active recall", "Passive reading", "Highlighting text", "Copying notes"], 0),
    ("What does spaced repetition help with?", ["Long-term memory", "Short-term speed", "File organization", "Network security"], 0),
    ("What is a learning objective?", ["A specific goal for the lesson", "A grading rubric", "A homework assignment", "A test question"], 0),
    ("Which is a formative assessment?", ["Quiz during learning", "Final exam", "Entry test", "Graduation requirement"], 0),
    ("What is the benefit of project-based learning?", ["Applying knowledge practically", "Memorizing facts", "Reading faster", "Writing longer essays"], 0),
    ("What does collaborative learning involve?", ["Working with peers", "Studying alone", "Watching videos", "Taking notes"], 0),
    ("What is metacognition?", ["Thinking about thinking", "Advanced computing", "Fast reading", "Database design"], 0),
]

ARTICLE_BODIES = [
    "## Key Concepts\n\nIn this section, we explore the fundamental concepts that form the foundation of this topic. Understanding these principles is essential before moving on to more advanced material.\n\n### Prerequisites\n\n- Basic understanding of the subject area\n- Familiarity with core terminology\n- Access to a development environment (if applicable)\n\n### Core Principles\n\n1. **Abstraction** — Simplifying complex systems by focusing on essential features\n2. **Modularity** — Breaking down problems into manageable, reusable components\n3. **Iteration** — Continuously improving through feedback and practice\n\n> Remember: Mastery comes from consistent practice combined with theoretical understanding.\n\n### Summary\n\nThe concepts covered here will be referenced throughout the rest of the course. Take time to review and understand each principle before proceeding.",
    "## Practical Application\n\nNow that you understand the theory, let's apply it to real scenarios. This section bridges the gap between conceptual knowledge and hands-on practice.\n\n### Getting Started\n\nBefore diving in, ensure you have:\n- Completed the prerequisite modules\n- Set up your workspace\n- Downloaded any necessary tools\n\n### Step-by-Step Guide\n\n1. **Identify the problem** — Clearly define what you're trying to solve\n2. **Plan your approach** — Outline the steps before implementing\n3. **Implement incrementally** — Build in small, testable pieces\n4. **Test and validate** — Verify each component works correctly\n5. **Refine and optimize** — Improve based on results\n\n### Common Pitfalls\n\n- Rushing through without understanding fundamentals\n- Not testing incrementally\n- Ignoring edge cases",
    "## Advanced Techniques\n\nThis section covers advanced strategies that separate beginners from professionals. These techniques require a solid foundation in the basics.\n\n### Professional Best Practices\n\n| Practice | Benefit | Difficulty |\n|----------|---------|------------|\n| Code review | Catches bugs early | Medium |\n| Documentation | Improves maintainability | Low |\n| Testing | Ensures reliability | Medium |\n| Monitoring | Detects issues fast | High |\n\n### Industry Standards\n\nProfessionals in this field follow established standards and conventions. Adhering to these standards:\n- Makes collaboration easier\n- Improves code quality\n- Reduces technical debt\n\n### Next Steps\n\nAfter mastering these techniques, you'll be ready to tackle the final project module.",
]

LESSON_BODIES = [
    "Welcome to this lesson. We'll cover the essential concepts you need to understand before moving forward.\n\nKey takeaways:\n- Understanding the fundamental building blocks\n- How these concepts connect to real-world applications\n- Common mistakes to avoid\n\nTake your time with this material — it forms the foundation for everything that follows.",
    "In this lesson, we'll explore practical techniques that you can immediately apply. Each concept is accompanied by examples and exercises.\n\nRemember to practice each technique as you learn it. Active engagement is the key to retention.\n\nBy the end of this lesson, you should be able to:\n- Apply the core techniques independently\n- Identify when to use each approach\n- Debug common issues",
    "This lesson synthesizes everything you've learned so far into a cohesive understanding. We'll connect the dots between individual concepts and see how they work together in practice.\n\nFocus on understanding the relationships between concepts rather than memorizing individual facts.\n\nThe exercises in this lesson are designed to challenge you — don't be discouraged if they require multiple attempts.",
]


class Command(BaseCommand):
    help = "Seed 300 diverse courses with modules, lessons, quizzes, and resources"

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=300, help="Number of courses")
        parser.add_argument("--clear", action="store_true", help="Delete all seeded data first")

    def handle(self, *args, **options):
        count = options["count"]
        if options["clear"]:
            self._clear()

        self.stdout.write("Creating instructors...")
        instructors = self._create_instructors()

        self.stdout.write("Creating learners...")
        learners = self._create_learners()

        self.stdout.write("Creating categories & tags...")
        categories = self._create_categories()
        tags = self._create_tags()

        self.stdout.write(f"Creating {count} courses with modules, lessons & quizzes...")
        stats = {"courses": 0, "modules": 0, "lessons": 0, "quizzes": 0, "questions": 0}

        all_topics = []
        for cat_name, topics in CATEGORIES:
            for topic in topics:
                all_topics.append((cat_name, topic))

        course_idx = 0
        while course_idx < count:
            cat_name, topic = all_topics[course_idx % len(all_topics)]
            variation = course_idx // len(all_topics)
            self._create_course(
                topic, cat_name, variation, instructors, categories, tags, stats,
            )
            course_idx += 1
            if course_idx % 50 == 0:
                self.stdout.write(f"  ... {course_idx}/{count} courses created")

        self._create_enrollments(learners, stats)

        self.stdout.write(self.style.SUCCESS(
            f"\nDone! Created:\n"
            f"  {stats['courses']} courses\n"
            f"  {stats['modules']} modules\n"
            f"  {stats['lessons']} lessons/resources/articles/videos\n"
            f"  {stats['quizzes']} quizzes ({stats['questions']} questions)\n"
        ))

    def _clear(self):
        self.stdout.write(self.style.WARNING("Clearing seeded data..."))
        seeded_emails = [e for _, _, e in INSTRUCTORS] + [e for _, _, e in LEARNERS]
        seeded_users = User.objects.filter(email__in=seeded_emails)
        ContentEntity.all_objects.filter(owner__in=seeded_users).delete()
        self.stdout.write("  Cleared seeded content entities.")

    def _create_instructors(self):
        instructors = []
        for first, last, email in INSTRUCTORS:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={"first_name": first, "last_name": last, "role": "instructor"},
            )
            if created or not user.has_usable_password():
                user.set_password("instructor123")
                user.save()
            instructors.append(user)
        return instructors

    def _create_learners(self):
        learners = []
        for first, last, email in LEARNERS:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={"first_name": first, "last_name": last, "role": "learner"},
            )
            if created or not user.has_usable_password():
                user.set_password("learner123")
                user.save()
            learners.append(user)
        return learners

    def _create_categories(self):
        cat_map = {}
        for cat_name, _ in CATEGORIES:
            cat, _ = Category.objects.get_or_create(name=cat_name)
            cat_map[cat_name] = cat
        return cat_map

    def _create_tags(self):
        tag_objs = []
        for tag_name in TAGS:
            tag, _ = Tag.objects.get_or_create(name=tag_name)
            tag_objs.append(tag)
        return tag_objs

    def _create_course(self, topic, cat_name, variation, instructors, categories, tags, stats):
        template = COURSE_TEMPLATES.get(cat_name, DEFAULT_TEMPLATE)
        prefix_list = template["prefixes"]
        desc_list = template["descriptions"]
        mod_templates = template["module_templates"]

        title_tpl = prefix_list[variation % len(prefix_list)]
        title = title_tpl.format(topic=topic)
        description = random.choice(desc_list).format(topic=topic)
        short_desc = description[:200] + "..." if len(description) > 200 else description

        instructor = random.choice(instructors)
        level = random.choice([LevelCode.BEGINNER, LevelCode.INTERMEDIATE, LevelCode.ADVANCED])
        visibility = random.choices(
            [VisibilityCode.EVERYONE, VisibilityCode.SIGNED_IN], weights=[80, 20]
        )[0]
        access = random.choices(
            [AccessRuleCode.OPEN, AccessRuleCode.INVITATION, AccessRuleCode.PAYMENT],
            weights=[70, 15, 15],
        )[0]
        status = random.choices(
            [StatusCode.PUBLISHED, StatusCode.DRAFT, StatusCode.ARCHIVED],
            weights=[85, 10, 5],
        )[0]

        price = None
        if access == AccessRuleCode.PAYMENT:
            price = random.choice([9.99, 19.99, 29.99, 49.99, 79.99, 99.99, 149.99, 199.99])

        course = ContentEntity.objects.create(
            entity_type=EntityType.COURSE,
            title=title,
            short_description=short_desc,
            description=description,
            owner=instructor,
            status_code=status,
            estimated_duration_seconds=random.randint(3600, 72000),
        )
        if status == StatusCode.PUBLISHED:
            course.published_at = timezone.now()
            course.save(update_fields=["published_at"])

        CourseSettings.objects.create(
            entity=course,
            visibility_code=visibility,
            access_rule_code=access,
            price=price,
            level_code=level,
            responsible=instructor,
        )
        EntityStats.objects.create(entity=course)

        cat_obj = categories.get(cat_name)
        if cat_obj:
            EntityCategory.objects.get_or_create(entity=course, category=cat_obj)

        num_tags = random.randint(2, 5)
        chosen_tags = random.sample(tags, min(num_tags, len(tags)))
        for tag in chosen_tags:
            EntityTag.objects.get_or_create(entity=course, tag=tag)

        stats["courses"] += 1

        num_modules = random.randint(2, 6)
        chosen_mods = random.sample(
            mod_templates, min(num_modules, len(mod_templates))
        )

        for mod_idx, mod_title_tpl in enumerate(chosen_mods):
            mod_title = mod_title_tpl.format(topic=topic)
            mod_entity = ContentEntity.objects.create(
                entity_type=EntityType.MODULE,
                title=mod_title,
                owner=instructor,
                status_code=StatusCode.PUBLISHED,
            )
            ContentStructure.objects.create(
                parent_entity=course, child_entity=mod_entity,
                sort_order=mod_idx,
                unlock_rule_code=UnlockRuleCode.AFTER_PREVIOUS,
            )
            stats["modules"] += 1

            num_lessons = random.randint(2, 7)
            mod_topic = mod_title.replace(topic, "").strip(" :;-—") or topic

            for les_idx in range(num_lessons):
                lesson_type = random.choices(
                    ["video", "article", "lesson_text", "resource"],
                    weights=[35, 20, 30, 15],
                )[0]
                self._create_lesson(
                    lesson_type, topic, mod_topic, mod_entity, instructor,
                    les_idx, stats,
                )

            if random.random() < 0.75:
                self._create_quiz(
                    topic, cat_name, mod_entity, instructor, num_lessons, stats,
                )

    def _create_lesson(self, lesson_type, topic, mod_topic, mod_entity, instructor, sort_order, stats):
        title_options = LESSON_TITLES.get(lesson_type, LESSON_TITLES["lesson_text"])
        title = random.choice(title_options).format(mod_topic=mod_topic or topic)

        if lesson_type == "video":
            entity = ContentEntity.objects.create(
                entity_type=EntityType.VIDEO,
                title=title,
                owner=instructor,
                status_code=StatusCode.PUBLISHED,
                estimated_duration_seconds=random.randint(180, 2400),
            )
            duration = random.randint(180, 2400)
            VideoContent.objects.create(
                entity=entity,
                video_url=random.choice(VIDEO_URLS),
                duration_seconds=duration,
                allow_download=random.choice([True, False]),
                transcript_text=f"Transcript for: {title}\n\nThis is a placeholder transcript covering {topic}.",
            )
        elif lesson_type == "article":
            entity = ContentEntity.objects.create(
                entity_type=EntityType.ARTICLE,
                title=title,
                owner=instructor,
                status_code=StatusCode.PUBLISHED,
            )
            body = random.choice(ARTICLE_BODIES).replace("this topic", topic)
            reading_time = random.randint(120, 900)
            ArticleContent.objects.create(
                entity=entity,
                body_markdown=body,
                reading_time_seconds=reading_time,
            )
        elif lesson_type == "resource":
            entity = ContentEntity.objects.create(
                entity_type=EntityType.RESOURCE,
                title=title,
                owner=instructor,
                status_code=StatusCode.PUBLISHED,
            )
            kind = random.choice([
                ResourceKind.PDF, ResourceKind.IMAGE,
                ResourceKind.WORKSHEET, ResourceKind.ATTACHMENT,
                ResourceKind.EXTERNAL_LINK,
            ])
            url = ""
            if kind == ResourceKind.EXTERNAL_LINK:
                url = f"https://docs.example.com/{topic.lower().replace(' ', '-')}"
            elif kind == ResourceKind.PDF:
                url = f"https://example.com/resources/{topic.lower().replace(' ', '-')}.pdf"
            ResourceContent.objects.create(
                entity=entity,
                resource_kind=kind,
                resource_url=url,
                allow_download=True,
            )
        else:
            entity = ContentEntity.objects.create(
                entity_type=EntityType.LESSON,
                title=title,
                owner=instructor,
                status_code=StatusCode.PUBLISHED,
            )
            body = random.choice(LESSON_BODIES)
            LessonContent.objects.create(
                entity=entity,
                body=body,
                lesson_format=random.choice([
                    LessonFormat.TEXT, LessonFormat.MIXED, LessonFormat.GUIDED,
                ]),
            )

        ContentStructure.objects.create(
            parent_entity=mod_entity, child_entity=entity,
            sort_order=sort_order,
            unlock_rule_code=UnlockRuleCode.AFTER_PREVIOUS,
        )
        stats["lessons"] += 1

    def _create_quiz(self, topic, cat_name, mod_entity, instructor, sort_order, stats):
        quiz_entity = ContentEntity.objects.create(
            entity_type=EntityType.QUIZ,
            title=f"Quiz: {mod_entity.title}",
            owner=instructor,
            status_code=StatusCode.PUBLISHED,
        )
        pass_pct = random.choice([50, 60, 70, 80])
        attempt_limit = random.choice([0, 1, 2, 3, 5])
        time_limit = random.choice([None, None, 300, 600, 900, 1200, 1800])
        QuizContent.objects.create(
            entity=quiz_entity,
            instructions=f"Answer the following questions about {topic}. You need {pass_pct}% to pass.",
            pass_percentage=pass_pct,
            attempt_limit=attempt_limit,
            shuffle_questions=random.choice([True, False]),
            shuffle_options=random.choice([True, False]),
            show_answers_after_submit=True,
            show_score_immediately=True,
            time_limit_seconds=time_limit,
            award_points=True,
        )

        QuizRewardRule.objects.bulk_create([
            QuizRewardRule(quiz_entity=quiz_entity, attempt_from=1, attempt_to=1, points_awarded=10),
            QuizRewardRule(quiz_entity=quiz_entity, attempt_from=2, attempt_to=3, points_awarded=5),
            QuizRewardRule(quiz_entity=quiz_entity, attempt_from=4, attempt_to=None, points_awarded=2),
        ])

        ContentStructure.objects.create(
            parent_entity=mod_entity, child_entity=quiz_entity,
            sort_order=sort_order,
            unlock_rule_code=UnlockRuleCode.AFTER_PREVIOUS,
        )

        bank = QUIZ_BANKS.get(cat_name, DEFAULT_QUIZ_BANK)
        num_questions = random.randint(3, min(8, len(bank)))
        chosen_qs = random.sample(bank, num_questions)

        for q_idx, (q_text, options, correct_idx) in enumerate(chosen_qs):
            question = QuizQuestion.objects.create(
                quiz_entity=quiz_entity,
                question_text=q_text,
                marks=random.choice([1, 2, 3]),
                sort_order=q_idx,
            )
            for o_idx, o_text in enumerate(options):
                QuizOption.objects.create(
                    question=question,
                    option_text=o_text,
                    is_correct=(o_idx == correct_idx),
                    sort_order=o_idx,
                )
            stats["questions"] += 1

        stats["quizzes"] += 1

    def _create_enrollments(self, learners, stats):
        from enrollment.models import CourseMembership, MembershipStatus, AccessMode

        published = list(
            ContentEntity.objects.filter(
                entity_type=EntityType.COURSE,
                status_code=StatusCode.PUBLISHED,
            ).values_list("id", flat=True)
        )
        if not published or not learners:
            return

        enrolled_count = 0
        for learner in learners:
            num_courses = random.randint(5, min(30, len(published)))
            chosen = random.sample(published, num_courses)
            for cid in chosen:
                _, created = CourseMembership.objects.get_or_create(
                    course_entity_id=cid,
                    user=learner,
                    defaults={
                        "membership_status": MembershipStatus.ACTIVE,
                        "access_mode": AccessMode.OPEN,
                        "enrolled_at": timezone.now(),
                    },
                )
                if created:
                    enrolled_count += 1

        self.stdout.write(f"  Created {enrolled_count} enrollments for {len(learners)} learners.")
