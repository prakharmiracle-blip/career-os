import os

# Point at the test DB before the app (and its engine) is imported.
os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://careeros:careeros@localhost:5432/careeros_test"
)
os.environ["AUTH_RATE_LIMIT"] = "1000/minute"
os.environ["JOB_REFRESH_ENABLED"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.ratelimit import limiter  # noqa: E402
from app.seed import seed  # noqa: E402


limiter.enabled = False  # every test shares one client IP; limits are not under test here


@pytest.fixture(scope="session", autouse=True)
def database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def demo(client):
    r = client.post("/api/auth/login", json={"email": "demo@careeros.app", "password": "Demo@1234"})
    assert r.status_code == 200, r.text
    return client
