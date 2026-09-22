from fastapi import FastAPI, Response
from fastapi.middleware.gzip import GZipMiddleware

from payloads import Payload, Payloads
from serial import fresh


def application(p: Payloads) -> FastAPI:
    """compressed: a sub-application that app.py mounts at /compressed, and its routes answer like
    any other. Starlette's GZipMiddleware on it gzips an answer when the request asks."""
    compressed = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    # rb:wiring compressed.*
    # At its defaults: a body under 500 bytes goes out as it is, and gzip runs at level 9.
    compressed.add_middleware(GZipMiddleware)

    # rb:handler compressed.gzip_small,compressed.identity_small
    @compressed.get("/small")
    async def small(response: Response) -> Payload:
        return fresh(response, p.small)

    # rb:handler compressed.gzip_large,compressed.identity_large
    @compressed.get("/large")
    async def large(response: Response) -> Payload:
        return fresh(response, p.large)

    return compressed
