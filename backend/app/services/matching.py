"""Rule-based job match scoring.

Phase 1 uses transparent rules, max 100: skills overlap 45, experience fit 20,
location 10, target-role title 25 (the stated target is the strongest intent signal).
Phase 2 adds embedding similarity + an LLM explanation on top; this module stays as the
deterministic baseline and fallback when the AI layer is unavailable.
"""

from app.models import Job, RoleType, User

ROLE_EXPERIENCE = {RoleType.student: 0, RoleType.fresher: 0, RoleType.experienced: 3}


def _norm(s: str) -> str:
    return s.strip().lower()


def score_job(user: User, job: Job) -> dict:
    user_skills = {_norm(s) for s in (user.skills or [])}
    job_skills = job.skills or []
    matched = [s for s in job_skills if _norm(s) in user_skills]
    missing = [s for s in job_skills if _norm(s) not in user_skills]

    reasons: list[str] = []

    skill_ratio = len(matched) / len(job_skills) if job_skills else 0
    skill_pts = round(45 * skill_ratio)
    if matched:
        reasons.append(f"You have {len(matched)} of {len(job_skills)} listed skills")

    user_exp = ROLE_EXPERIENCE.get(user.role_type, 0)
    if job.exp_min <= user_exp <= job.exp_max:
        exp_pts = 20
        reasons.append("Experience level fits the role")
    elif user_exp < job.exp_min:
        gap = job.exp_min - user_exp
        exp_pts = max(0, 20 - 7 * gap)
        reasons.append(f"Role asks for {job.exp_min}+ years")
    else:
        exp_pts = 12

    loc_pts = 0
    if user.location:
        city = _norm(user.location.split(",")[0])
        if city and city in _norm(job.location):
            loc_pts = 10
            reasons.append(f"Based in {job.location.split(',')[0]}")
    if job.work_mode == "Remote":
        loc_pts = 10
        if "Remote role" not in reasons:
            reasons.append("Remote role")

    title_pts = 0
    if user.target_role:
        target = _norm(user.target_role)
        title = _norm(job.title)
        target_words = {w for w in target.split() if len(w) > 2}
        overlap = target_words & set(title.split())
        if target in title:
            title_pts = 25
            reasons.append(f"Matches your target role: {user.target_role}")
        elif overlap and len(overlap) == len(target_words):
            title_pts = 20
            reasons.append(f"Matches your target role: {user.target_role}")
        elif overlap:
            title_pts = 5
            reasons.append(f"Related to your target role: {user.target_role}")

    score = min(100, skill_pts + exp_pts + loc_pts + title_pts)
    return {"score": score, "matched_skills": matched, "missing_skills": missing, "reasons": reasons}
