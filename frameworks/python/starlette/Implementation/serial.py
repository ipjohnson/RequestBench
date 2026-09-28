import os
import time
from itertools import count
from typing import Any

from starlette.responses import JSONResponse

# x-rb-serial: the Unix time in milliseconds, a bar, the worker's process id and one counter for
# each worker process. A handler that writes it takes the next count, so an answer the cache family
# replays carries the value it was stored with. Every worker counts from 1, and the process id keeps
# their values apart.
_serials = count(1)


def fresh(content: Any) -> JSONResponse:
    """The answer, with x-rb-serial written to show the handler ran for it."""
    serial = f"{time.time_ns() // 1_000_000}|{os.getpid()}-{next(_serials)}"
    return JSONResponse(content, headers={"x-rb-serial": serial})
