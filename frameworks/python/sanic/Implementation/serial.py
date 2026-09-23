from itertools import count

# x-rb-serial: one counter for each worker process. A handler that writes it takes the next value,
# so an answer the cache family replays carries the value it was stored with. The two workers
# count apart, and a connection stays with the worker that accepted it.
_serials = count(1)


def fresh() -> dict[str, str]:
    """The header that shows the handler ran for this answer."""
    return {"x-rb-serial": str(next(_serials))}
