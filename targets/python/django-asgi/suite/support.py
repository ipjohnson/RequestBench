# rb:test *
"""Sending one of an endpoint's planned requests through Django's AsyncClient.

AsyncClient is what SimpleTestCase hands a test as self.async_client. It never opens a socket
and never serializes a request: it builds an ASGI scope and calls the application with it, so
the response it returns is the HttpResponse the view produced. That makes response.content
the bytes as the view wrote them, gzip_page's included, without anything to undo.
"""
from floor import Answer
import planned


async def send(client, a, headers=None):
    headers = dict(headers or a.headers)
    content_type = headers.pop("content-type", "application/octet-stream")
    r = await client.generic(a.method, a.path, data=a.body or "",
                             content_type=content_type, headers=headers)
    return Answer(r.status_code, r.headers.get("Content-Type", ""),
                  r.headers.get("Content-Encoding", ""), r.content, r.headers)


async def send_after_capture(client, a):
    """Ask for the validator first, then send the request that carries it."""
    method, path, header = planned.capture_for(a)
    first = await client.generic(method, path)
    return await send(client, a, planned.resolved(a, first.headers.get(header, "")))
# rb:end
