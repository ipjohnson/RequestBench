from itertools import count

from django.http import HttpResponseBase

# x-rb-serial: one counter for each worker process, shared by its threads. A view that writes it
# takes the next value, so an answer the cache family replays carries the value it was stored with.
# The two workers count apart, and a connection stays with the worker that accepted it.
_serials = count(1)


def fresh[R: HttpResponseBase](response: R) -> R:
    """The response, with x-rb-serial written to show the view ran for it."""
    response["x-rb-serial"] = str(next(_serials))
    return response
