"""Seed script: 40 companies, 200 realistic Indian-market jobs, and a demo user.

Run:  python -m app.seed            (idempotent: skips if jobs already exist)
      python -m app.seed --reset    (wipes seed data and re-creates it)

Deterministic (fixed random seed) so tests and screenshots are stable.
"""

from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import (
    Activity,
    Application,
    ApplicationStatus,
    Company,
    Job,
    RoleType,
    SavedJob,
    User,
)
from app.security import hash_password

DEMO_EMAIL = "demo@careeros.app"
DEMO_PASSWORD = "Demo@1234"

COMPANIES = [
    ("Google", "Internet", "#4285F4"), ("Microsoft", "Software", "#00A4EF"),
    ("Deloitte", "Consulting", "#111111"), ("TCS", "IT Services", "#E4202E"),
    ("Accenture", "Consulting", "#A100FF"), ("Flipkart", "E-commerce", "#2874F0"),
    ("Amazon", "E-commerce", "#FF9900"), ("Infosys", "IT Services", "#007CC3"),
    ("Wipro", "IT Services", "#341C53"), ("Zoho", "SaaS", "#E42527"),
    ("Freshworks", "SaaS", "#25C16F"), ("Swiggy", "Food Tech", "#FC8019"),
    ("Zomato", "Food Tech", "#E23744"), ("PhonePe", "Fintech", "#5F259F"),
    ("Paytm", "Fintech", "#00BAF2"), ("HCLTech", "IT Services", "#0F5FDC"),
    ("Tech Mahindra", "IT Services", "#C8102E"), ("Cognizant", "IT Services", "#1A4CA1"),
    ("Capgemini", "Consulting", "#0070AD"), ("IBM", "Software", "#0F62FE"),
    ("Oracle", "Software", "#C74634"), ("Adobe", "Software", "#FA0F00"),
    ("Salesforce", "SaaS", "#00A1E0"), ("SAP Labs", "Software", "#0A6ED1"),
    ("Atlassian", "SaaS", "#0052CC"), ("Uber", "Mobility", "#000000"),
    ("Meesho", "E-commerce", "#F43397"), ("CRED", "Fintech", "#1C1C1C"),
    ("Nykaa", "E-commerce", "#FC2779"), ("Myntra", "E-commerce", "#FF3F6C"),
    ("Juspay", "Fintech", "#0B5FFF"), ("Postman", "Developer Tools", "#FF6C37"),
    ("BrowserStack", "Developer Tools", "#F2672A"), ("InMobi", "Ad Tech", "#3C3C8C"),
    ("Fractal Analytics", "Analytics", "#0F3B7A"), ("LatentView", "Analytics", "#1D4F91"),
    ("Tiger Analytics", "Analytics", "#F7941D"), ("Ola", "Mobility", "#1C1C1C"),
    ("Groww", "Fintech", "#00D09C"), ("Razorpay", "Fintech", "#0C2451"),
]

# title -> (skills pool, salary band LPA at entry level, family)
ROLES: dict[str, tuple[list[str], tuple[int, int], str]] = {
    "Software Engineer": (["Java", "Python", "Data Structures", "System Design", "SQL", "Git", "AWS"], (8, 18), "eng"),
    "Frontend Developer": (["React", "TypeScript", "JavaScript", "CSS", "Next.js", "Redux", "Testing"], (6, 16), "eng"),
    "Backend Developer": (["Node.js", "Python", "PostgreSQL", "REST APIs", "Docker", "Redis", "Microservices"], (7, 18), "eng"),
    "Full Stack Developer": (["React", "Node.js", "TypeScript", "MongoDB", "PostgreSQL", "Docker", "AWS"], (7, 20), "eng"),
    "AI Engineer": (["Python", "LLMs", "LangChain", "RAG", "PyTorch", "Vector Databases", "FastAPI"], (10, 28), "ai"),
    "AI/ML Engineer": (["Python", "Machine Learning", "PyTorch", "TensorFlow", "MLOps", "SQL", "AWS"], (12, 30), "ai"),
    "Machine Learning Engineer": (["Python", "Machine Learning", "Scikit-learn", "Deep Learning", "MLOps", "Spark"], (12, 30), "ai"),
    "Generative AI Analyst": (["Python", "Prompt Engineering", "LLMs", "RAG", "OpenAI", "Azure", "SQL"], (8, 14), "ai"),
    "Data Scientist": (["Python", "Statistics", "Machine Learning", "SQL", "Pandas", "Tableau"], (10, 24), "data"),
    "Data Analyst": (["SQL", "Excel", "Power BI", "Python", "Statistics", "Tableau"], (4, 10), "data"),
    "Data Engineer": (["Python", "Spark", "Airflow", "SQL", "Kafka", "AWS", "dbt"], (9, 22), "data"),
    "DevOps Engineer": (["Docker", "Kubernetes", "AWS", "Terraform", "CI/CD", "Linux", "Python"], (8, 20), "eng"),
    "Cloud Engineer": (["AWS", "Azure", "Terraform", "Networking", "Linux", "Kubernetes"], (7, 18), "eng"),
    "QA Automation Engineer": (["Selenium", "Java", "Cypress", "API Testing", "CI/CD", "Testing"], (5, 12), "eng"),
    "Product Manager": (["Product Strategy", "Roadmapping", "SQL", "User Research", "Analytics", "Stakeholder Management"], (15, 35), "pm"),
    "Associate Product Manager": (["Product Strategy", "User Research", "SQL", "Analytics", "Wireframing"], (12, 20), "pm"),
    "UI/UX Designer": (["Figma", "User Research", "Prototyping", "Design Systems", "Wireframing"], (6, 16), "design"),
    "Business Analyst": (["SQL", "Excel", "Requirements Gathering", "Power BI", "Stakeholder Management"], (6, 14), "data"),
    "Android Developer": (["Kotlin", "Android", "Jetpack Compose", "REST APIs", "Git"], (7, 18), "eng"),
    "Cybersecurity Analyst": (["Network Security", "SIEM", "Linux", "Incident Response", "Python"], (6, 16), "eng"),
}

CITIES = [
    "Bengaluru, India", "Hyderabad, India", "Pune, India", "Gurugram, India", "Noida, India",
    "Mumbai, India", "Chennai, India", "Kolkata, India", "Ahmedabad, India", "Lucknow, India",
]
MODES = ["On-site", "Hybrid", "Hybrid", "Remote"]
TYPES = ["Full-time"] * 8 + ["Internship", "Contract"]

RESPONSIBILITIES = {
    "eng": [
        "Design, build and ship features end to end with high code quality",
        "Write unit and integration tests and take part in code reviews",
        "Own services in production: monitoring, on-call and performance",
        "Collaborate with product and design to scope and estimate work",
        "Improve developer tooling, CI/CD and documentation",
    ],
    "ai": [
        "Develop and integrate GenAI solutions into enterprise products",
        "Build RAG pipelines and agentic workflows over company data",
        "Evaluate model quality, latency and cost; run experiments",
        "Work with OpenAI, Azure or cloud LLM services in production",
        "Collaborate with cross-functional teams to ship AI features",
    ],
    "data": [
        "Build dashboards and analyses that drive business decisions",
        "Write efficient SQL and maintain clean, documented datasets",
        "Partner with stakeholders to define metrics and answer questions",
        "Automate recurring reports and data quality checks",
        "Present findings clearly to technical and non-technical audiences",
    ],
    "pm": [
        "Own the roadmap for a product area and define success metrics",
        "Run user research and translate insights into clear specs",
        "Work closely with engineering and design through delivery",
        "Analyse product data to prioritise opportunities",
        "Communicate plans and progress to leadership and stakeholders",
    ],
    "design": [
        "Design end-to-end user flows, wireframes and high-fidelity UI",
        "Run usability tests and iterate based on findings",
        "Contribute to and maintain the design system",
        "Partner with PMs and engineers from discovery to launch",
    ],
}


def _description(title: str, company: str, skills: list[str], mode: str) -> str:
    return (
        f"{company} is hiring a {title} to join a fast-growing team. You will work on products used by "
        f"millions of customers, with ownership from idea to production. The role is {mode.lower()} and "
        f"suits someone comfortable with {', '.join(skills[:3])}. We value clear communication, curiosity "
        f"and a bias for shipping. You will get mentorship, a learning budget and a strong peer group."
    )


def generate_jobs():
    """Returns NormalizedJob records (deterministic)."""
    from app.services.job_sources import NormalizedJob

    rng = random.Random(42)
    now = datetime.now(timezone.utc)
    titles = list(ROLES)
    out = []
    for i in range(200):
        title = titles[i % len(titles)]
        skills_pool, (smin, smax), family = ROLES[title]
        company = COMPANIES[rng.randrange(len(COMPANIES))][0]
        exp_min = rng.choice([0, 0, 1, 1, 2, 3, 4, 5])
        exp_max = exp_min + rng.choice([2, 3, 4])
        bump = exp_min * 3
        sal_min = smin + bump + rng.randint(0, 2)
        sal_max = max(sal_min + 4, smax + bump + rng.randint(0, 4))
        job_type = rng.choice(TYPES)
        if job_type == "Internship":
            exp_min, exp_max, sal_min, sal_max = 0, 0, 3, 6
        mode = rng.choice(MODES)
        skills = rng.sample(skills_pool, k=min(len(skills_pool), rng.randint(4, 6)))
        resp = RESPONSIBILITIES.get(family, RESPONSIBILITIES["eng"])
        out.append(
            NormalizedJob(
                source="seed",
                external_id=f"seed-{i + 1}",
                title=title if job_type != "Internship" else f"{title} Intern",
                company=company,
                location=rng.choice(CITIES),
                work_mode=mode,
                job_type=job_type,
                salary_min_lpa=sal_min,
                salary_max_lpa=sal_max,
                exp_min=exp_min,
                exp_max=exp_max,
                description=_description(title, company, skills, mode),
                responsibilities=rng.sample(resp, k=min(4, len(resp))),
                skills=skills,
                posted_at=now - timedelta(hours=rng.randint(2, 24 * 30)),
            )
        )
    return out


def seed(db: Session, reset: bool = False) -> None:
    if reset:
        for model in (Activity, Application, SavedJob, Job):
            db.execute(delete(model))
        db.execute(delete(User).where(User.email == DEMO_EMAIL))
        db.execute(delete(Company))
        db.commit()

    if db.scalar(select(func.count(Job.id))):
        print("Jobs already seeded; use --reset to re-create.")
        return

    companies: dict[str, Company] = {}
    for name, industry, color in COMPANIES:
        c = Company(name=name, industry=industry, brand_color=color, about=f"{name} is a leading {industry.lower()} company in India.")
        db.add(c)
        companies[name] = c
    db.flush()

    jobs: list[Job] = []
    for nj in generate_jobs():
        j = Job(
            company_id=companies[nj.company].id,
            title=nj.title, location=nj.location, work_mode=nj.work_mode, job_type=nj.job_type,
            salary_min_lpa=nj.salary_min_lpa, salary_max_lpa=nj.salary_max_lpa,
            exp_min=nj.exp_min, exp_max=nj.exp_max, description=nj.description,
            responsibilities=nj.responsibilities, skills=nj.skills,
            source=nj.source, external_id=nj.external_id, posted_at=nj.posted_at,
        )
        db.add(j)
        jobs.append(j)
    db.flush()

    _seed_demo_user(db, jobs)
    db.commit()
    print(f"Seeded {len(companies)} companies, {len(jobs)} jobs and demo user {DEMO_EMAIL} / {DEMO_PASSWORD}")


def _seed_demo_user(db: Session, jobs: list[Job]) -> None:
    rng = random.Random(7)
    now = datetime.now(timezone.utc)
    user = User(
        name="Prakhar Pandey", email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD),
        role_type=RoleType.fresher, headline="Job Seeker", target_role="AI Engineer",
        location="Bengaluru, India", onboarded=True,
        skills=["Python", "LLMs", "LangChain", "RAG", "OpenAI", "SQL", "React", "FastAPI", "Machine Learning"],
    )
    db.add(user)
    db.flush()

    statuses = (
        [ApplicationStatus.applied] * 10 + [ApplicationStatus.under_review] * 3
        + [ApplicationStatus.interview_scheduled] * 6 + [ApplicationStatus.offer] * 3
        + [ApplicationStatus.rejected] * 2
    )
    picked = rng.sample(jobs, k=len(statuses) + 12)
    for job, status in zip(picked, statuses):
        db.add(Application(user_id=user.id, job_id=job.id, status=status,
                           applied_at=now - timedelta(days=rng.randint(1, 28))))
    for job in picked[len(statuses):]:
        db.add(SavedJob(user_id=user.id, job_id=job.id))

    today_6pm = now.replace(hour=12, minute=30, second=0, microsecond=0)  # 6:00 PM IST
    db.add_all([
        Activity(user_id=user.id, kind="interview", title="Interview Preparation",
                 subtitle="Frontend Developer – Google", starts_at=today_6pm + timedelta(days=0 if now < today_6pm else 1)),
        Activity(user_id=user.id, kind="resume_review", title="Resume Review",
                 subtitle="Get AI suggestions", starts_at=(now + timedelta(days=1)).replace(hour=5, minute=30)),
        Activity(user_id=user.id, kind="practice", title="Aptitude Practice",
                 subtitle="30 min session", starts_at=(now + timedelta(days=5)).replace(hour=4, minute=30)),
    ])


if __name__ == "__main__":
    with SessionLocal() as session:
        seed(session, reset="--reset" in sys.argv)
