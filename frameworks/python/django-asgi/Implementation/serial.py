import os
import time
from itertools import count

from django.http import HttpResponse

# x-rb-serial: the Unix time in milliseconds, a bar, the worker's process id and one counter for
# each worker process. A view that writes it takes the next count, so an answer the cache family
# replays carries the value it was stored with. Every worker counts from 1, and the process id keeps
# their values apart.
_serials = count(1)


def fresh[R: HttpResponse](response: R) -> R:
    """The response, with x-rb-serial written to show the view ran for it."""
    response["x-rb-serial"] = f"{time.time_ns() // 1_000_000}|{os.getpid()}-{next(_serials)}"
    return response
