import os
import time
from itertools import count

# x-rb-serial: the Unix time in milliseconds, a bar, the worker's process id and one counter for
# each worker process. A handler that writes it takes the next count, so an answer the cache family
# replays carries the value it was stored with. Every worker counts from 1, and the process id keeps
# their values apart.
_serials = count(1)


def fresh() -> dict[str, str]:
    """The header that shows the handler ran for this answer."""
    return {"x-rb-serial": f"{time.time_ns() // 1_000_000}|{os.getpid()}-{next(_serials)}"}
