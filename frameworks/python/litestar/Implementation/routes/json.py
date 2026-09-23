from litestar import Router, get

from payloads import Payload, Payloads


def router(p: Payloads) -> Router:
    """json: a payload the framework already holds, encoded by msgspec from the Struct the handler
    returns. Three static routes rather than one with a capture, so the router pays no capture here."""

    @get("/json/small")
    async def small() -> Payload:
        return p.small

    @get("/json/medium")
    async def medium() -> Payload:
        return p.medium

    @get("/json/large")
    async def large() -> Payload:
        return p.large

    return Router(path="/", route_handlers=[small, medium, large])
