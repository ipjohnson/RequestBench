from fastapi import APIRouter

from payloads import Payload, Payloads


def router(p: Payloads) -> APIRouter:
    """json: a payload the framework already holds, serialised by Pydantic from the declared return
    type. Three static routes rather than one with a capture, so the router pays no capture here."""
    routes = APIRouter()

    @routes.get("/json/small")
    async def small() -> Payload:
        return p.small

    @routes.get("/json/medium")
    async def medium() -> Payload:
        return p.medium

    @routes.get("/json/large")
    async def large() -> Payload:
        return p.large

    return routes
