from slowapi import Limiter
from slowapi.util import get_remote_address

# In-memory store for dev. For multiple API instances, pass storage_uri="redis://..."
limiter = Limiter(key_func=get_remote_address)
