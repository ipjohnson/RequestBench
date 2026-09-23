from itertools import count
from typing import Any

from starlette.responses import JSONResponse

# x-rb-serial: one counter for each worker process. A handler that writes it takes the next value,
# so an answer the cache family replays carries the value it was stored with. The two workers
# count apart, and a connection stays with the worker that accepted it.
_serials = count(1)


def fresh(content: Any) -> JSONResponse:
    """The answer, with x-rb-serial written to show the handler ran for it."""
    return JSONResponse(content, headers={"x-rb-serial": str(next(_serials))})
