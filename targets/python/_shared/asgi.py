"""The two caching middlewares a target holds when its framework ships neither.

Starlette ships no conditional-request handling for a dynamic response and no response
cache, so FastAPI and the Starlette target both have to bring their own. What is the
framework's own here is the extension point: this is plain ASGI middleware, the same shape
``GZipMiddleware`` is, mounted so it reaches the feature's routes and nothing else.

It lives beside the shared domain rather than in each target for the reason the domain does:
two targets on the same ASGI stack drifting on a digest or on how a key is built would read
as a framework difference, and it is not one. The scoping is still each target's own, and
that is where they actually differ.
"""
from . import domain as d

_HOP = (b"content-length", b"content-type")


def _header(scope, name):
    for key, value in scope["headers"]:
        if key == name:
            return value
    return None


class ConditionalGet:
    """Hash the response body, write the validator, answer if-none-match with a 304.

    Shallow, which is the point: the handler runs and the body is built before anything is
    compared, so the 304 saves the write and nothing else.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        asked = _header(scope, b"if-none-match")
        start, chunks = {}, []

        async def collect(message):
            if message["type"] == "http.response.start":
                start.update(message)
                return
            if message["type"] != "http.response.body":
                return await send(message)
            chunks.append(message.get("body", b""))
            if message.get("more_body"):
                return
            body = b"".join(chunks)
            etag = d.content_etag(body).encode()
            headers = [(k, v) for k, v in start["headers"] if k != b"etag"]
            headers.append((b"etag", etag))
            if asked == etag:
                await send({"type": "http.response.start", "status": 304,
                            "headers": [(k, v) for k, v in headers if k not in _HOP]})
                return await send({"type": "http.response.body", "body": b""})
            await send({"type": "http.response.start", "status": start["status"],
                        "headers": headers})
            await send({"type": "http.response.body", "body": body})

        await self.app(scope, receive, collect)


class ResponseCache:
    """Store the whole response and replay it, keyed by path and by the named headers.

    The store is an LRU with a TTL, sized from the fixture: the key count the plan produces
    is what a response cache has to hold, and one smaller than that evicts inside the
    measured window. Only a 200 is stored, and the stored bytes go back out untouched, which
    is what makes x-rb-serial repeat and prove the handler did not run.
    """

    def __init__(self, app, store, vary=None):
        self.app = app
        self.store = store
        # Request path to the header names that path is keyed on, as the client asked for
        # it: a Starlette mount adjusts root_path and leaves scope["path"] whole. One
        # middleware for the whole scope rather than one per route, because a mount cannot
        # serve its own bare path and a sub-application per row would put every vary row one
        # redirect away from the url the plan sends.
        self.vary = {path: tuple(n.encode() for n in names)
                     for path, names in (vary or {}).items()}

    def key(self, scope):
        path = scope["path"]
        parts = [path]
        for name in self.vary.get(path, ()):
            parts.append((_header(scope, name) or b"").decode())
        return "|".join(parts)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        key = self.key(scope)
        hit = self.store.get(key)
        if hit is not None:
            status, headers, body = hit
            await send({"type": "http.response.start", "status": status, "headers": headers})
            return await send({"type": "http.response.body", "body": body})
        start, chunks = {}, []

        async def collect(message):
            if message["type"] == "http.response.start":
                start.update(message)
                return await send(message)
            if message["type"] != "http.response.body":
                return await send(message)
            chunks.append(message.get("body", b""))
            if not message.get("more_body") and start.get("status") == 200:
                self.store[key] = (200, list(start["headers"]), b"".join(chunks))
            await send(message)

        await self.app(scope, receive, collect)
