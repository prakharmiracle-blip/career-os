import hmac

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings

PROXY_HEADER = "x-careeros-proxy"


def from_trusted_proxy(request: Request) -> bool:
    secret = get_settings().proxy_secret
    return bool(secret) and hmac.compare_digest(request.headers.get(PROXY_HEADER, ""), secret)


def client_ip(request: Request) -> str:
    """Real client IP for rate limiting.

    Behind the Next.js proxy the socket address is the proxy's, so every user would
    share one limit. X-Forwarded-For is only trusted when the request carries the
    proxy secret; otherwise a client could spoof it to dodge the limit.
    """
    if from_trusted_proxy(request):
        fwd = request.headers.get("x-forwarded-for", "")
        if fwd:
            return fwd.split(",")[0].strip()
    return get_remote_address(request)


# In-memory store: fine for one API instance. For several, pass storage_uri="redis://...".
limiter = Limiter(key_func=client_ip)
