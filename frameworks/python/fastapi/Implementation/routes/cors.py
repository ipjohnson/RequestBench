from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from payloads import Payload, Payloads
from serial import fresh


def application(p: Payloads) -> FastAPI:
    """cors: a sub-application that app.py mounts at /cors. Starlette's CORSMiddleware on it answers a
    preflight before any route is matched, and adds its headers to the request itself. The handler
    writes x-rb-serial, so its absence on a preflight shows the middleware answered alone."""
    cors = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    # rb:wiring cors.*
    cors.add_middleware(CORSMiddleware, allow_origins=["https://shop.example.com"], allow_methods=["GET"],
                        allow_headers=["x-rb-tenant"], max_age=600)

    # rb:handler cors.request
    @cors.get("/small")
    async def small(response: Response) -> Payload:
        return fresh(response, p.small)

    return cors
