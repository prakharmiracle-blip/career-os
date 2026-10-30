import io
import uuid

from tests.test_ai import FakeMessages, fake_ai  # noqa: F401  (fixture)
from tests.test_resume import RESUME_TEXT, _pdf

STRONG = {
    "basics": {
        "name": "Neha Verma", "title": "Data Analyst", "email": "neha@example.com", "phone": "+91 98765 43210",
        "location": "Pune, India", "linkedin": "linkedin.com/in/neha", "website": "",
        "summary": "Data analyst with two years of experience turning retail sales data into dashboards and weekly reports. "
                   "Strong in SQL, Python and Power BI, and comfortable presenting findings to store leadership.",
    },
    "experience": [{
        "role": "Data Analyst", "company": "Acme Retail", "location": "Pune", "start": "Jan 2024", "end": "Present",
        "bullets": [
            "Built Power BI sales dashboards used weekly by 40 store managers across western India",
            "Automated weekly reporting with Python and SQL, cutting preparation time by 6 hours each week",
            "Analysed A/B test results for 3 pricing experiments and presented findings to regional leadership",
        ],
    }],
    "projects": [],
    "education": [{"degree": "B.Com", "school": "Savitribai Phule Pune University", "start": "2019", "end": "2022", "score": "8.1 CGPA"}],
    "skills": ["SQL", "Python", "Power BI", "Excel", "Tableau", "Statistics", "Pandas"],
    "certifications": ["Google Data Analytics Certificate"],
}


def _signup(client, target="Data Analyst"):
    client.post("/api/auth/signup", json={"name": "Neha Verma", "email": f"n{uuid.uuid4().hex[:8]}@example.com", "password": "secret123", "role_type": "fresher"})
    client.patch("/api/me", json={"skills": ["SQL", "Python"], "target_role": target, "location": "Pune, India", "onboarded": True})


def test_create_prefills_from_profile_and_crud(client):
    _signup(client)
    r = client.post("/api/resumes", json={"title": "Analyst resume"}).json()
    assert r["data"]["basics"]["name"] == "Neha Verma" and r["data"]["basics"]["title"] == "Data Analyst"
    assert r["data"]["skills"] == ["SQL", "Python"] and r["template"] == "modern"
    rid = r["id"]
    u = client.put(f"/api/resumes/{rid}", json={"template": "minimal", "data": STRONG, "title": "Final"}).json()
    assert u["template"] == "minimal" and u["title"] == "Final" and u["data"]["experience"][0]["company"] == "Acme Retail"
    dup = client.post(f"/api/resumes/{rid}/duplicate").json()
    assert dup["title"] == "Final (copy)" and dup["data"] == u["data"]
    assert [x["id"] for x in client.get("/api/resumes").json()] == [dup["id"], rid]
    assert client.delete(f"/api/resumes/{dup['id']}").status_code == 204
    assert client.get(f"/api/resumes/{dup['id']}").status_code == 404


def test_validation_rejects_bad_template_and_oversized_lists(client):
    _signup(client)
    rid = client.post("/api/resumes", json={}).json()["id"]
    assert client.put(f"/api/resumes/{rid}", json={"template": "fancy"}).status_code == 422
    big = {**STRONG, "skills": [f"s{i}" for i in range(61)]}
    assert client.put(f"/api/resumes/{rid}", json={"data": big}).status_code == 422


def test_limit_of_ten_resumes(client):
    _signup(client)
    for _ in range(10):
        assert client.post("/api/resumes", json={}).status_code == 201
    r = client.post("/api/resumes", json={})
    assert r.status_code == 409 and "up to 10" in r.json()["detail"]


def test_ats_weak_vs_strong_and_keywords(client):
    _signup(client)
    rid = client.post("/api/resumes", json={}).json()["id"]
    weak = client.get(f"/api/resumes/{rid}/ats").json()
    assert weak["score"] < 30
    msgs = {c["id"]: c for c in weak["checks"]}
    assert not msgs["contact"]["pass"] and "phone" in msgs["contact"]["message"]
    assert weak["keywords_missing"]  # seed jobs for "Data Analyst" ask for things the profile lacks

    client.put(f"/api/resumes/{rid}", json={"data": STRONG})
    strong = client.get(f"/api/resumes/{rid}/ats").json()
    assert strong["score"] >= 85, strong
    assert sum(c["weight"] for c in strong["checks"]) == 100
    assert "Power BI" in strong["keywords_found"]


def test_ats_without_target_role_says_so(client):
    _signup(client, target="")
    client.patch("/api/me", json={"target_role": ""})
    rid = client.post("/api/resumes", json={}).json()["id"]
    kw = {c["id"]: c for c in client.get(f"/api/resumes/{rid}/ats").json()["checks"]}["keywords"]
    assert not kw["pass"] and "target role" in kw["message"]


def test_pdf_and_docx_downloads_for_every_template(client):
    import docx
    from pypdf import PdfReader

    _signup(client)
    rid = client.post("/api/resumes", json={}).json()["id"]
    unicode_name = {**STRONG, "basics": {**STRONG["basics"], "name": "Nehá Vérma"}}
    client.put(f"/api/resumes/{rid}", json={"data": unicode_name})
    for t in ("modern", "professional", "minimal"):
        client.put(f"/api/resumes/{rid}", json={"template": t})
        pdf = client.get(f"/api/resumes/{rid}/export", params={"format": "pdf"})
        assert pdf.status_code == 200 and pdf.headers["content-type"] == "application/pdf"
        assert 'filename="Neh-V-rma-My-resume.pdf"' in pdf.headers["content-disposition"] or "attachment" in pdf.headers["content-disposition"]
        text = "".join(p.extract_text() for p in PdfReader(io.BytesIO(pdf.content)).pages)
        assert "Acme Retail" in text and "cutting preparation time" in text  # real, selectable text for ATS
        assert "Nehá Vérma" in text

        dx = client.get(f"/api/resumes/{rid}/export", params={"format": "docx"})
        assert dx.status_code == 200
        body = "\n".join(p.text for p in docx.Document(io.BytesIO(dx.content)).paragraphs)
        assert "Acme Retail" in body and "Google Data Analytics Certificate" in body


def test_html_in_fields_is_escaped_in_pdf(client):
    from pypdf import PdfReader

    _signup(client)
    rid = client.post("/api/resumes", json={}).json()["id"]
    evil = {**STRONG, "basics": {**STRONG["basics"], "summary": "<b>bold</b> & <font size=90>big</font> claims"}}
    client.put(f"/api/resumes/{rid}", json={"data": evil})
    pdf = client.get(f"/api/resumes/{rid}/export")
    assert pdf.status_code == 200
    text = "".join(p.extract_text() for p in PdfReader(io.BytesIO(pdf.content)).pages)
    assert "<b>bold</b>" in text  # shown literally, not interpreted as markup


def test_other_users_cannot_touch_resume(client):
    _signup(client)
    rid = client.post("/api/resumes", json={}).json()["id"]
    client.cookies.clear()
    _signup(client)
    for call in (client.get(f"/api/resumes/{rid}"), client.get(f"/api/resumes/{rid}/export"), client.delete(f"/api/resumes/{rid}")):
        assert call.status_code == 404


def test_ai_helpers_off_without_key(client):
    _signup(client)
    rid = client.post("/api/resumes", json={}).json()["id"]
    assert client.post(f"/api/resumes/{rid}/improve", json={"bullet": "Made dashboards"}).status_code == 503
    assert client.post(f"/api/resumes/{rid}/import").status_code == 404  # no upload yet: explains that first


def test_ai_import_and_improve(client, fake_ai):  # noqa: F811
    _signup(client)
    client.post("/api/me/resume", files={"file": ("cv.pdf", _pdf(RESUME_TEXT), "application/pdf")})
    rid = client.post("/api/resumes", json={}).json()["id"]

    fake_ai.tool_input = {**STRONG, "basics": {**STRONG["basics"], "email": ""}}
    imported = client.post(f"/api/resumes/{rid}/import").json()
    assert imported["data"]["experience"][0]["company"] == "Acme Retail"
    assert imported["data"]["basics"]["email"].endswith("@example.com")  # filled from the account

    fake_ai.tool_input = {"improved": "Built Power BI dashboards for 40 store managers, cutting reporting time by [add number]"}
    r = client.post(f"/api/resumes/{rid}/improve", json={"bullet": "Made dashboards"}).json()
    assert "[add number]" in r["improved"]
    assert "do not invent" in fake_ai.calls[-1]["system"]
