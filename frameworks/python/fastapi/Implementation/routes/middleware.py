from fastapi import APIRouter, Depends

from payloads import Payload, Payloads


# rb:wiring middleware.*
async def noop() -> None:
    """One layer: FastAPI resolves it before the handler, and it does nothing else."""


def layers(count: int) -> list:
    """FastAPI has no middleware on a route. A route's layers are dependencies, and use_cache=False
    runs each of them, where FastAPI would otherwise resolve the same function once per request."""
    return [Depends(noop, use_cache=False) for _ in range(count)]
# rb:end


def router(p: Payloads) -> APIRouter:
    """middleware: no-op layers in front of the handler."""
    routes = APIRouter()

    @routes.get("/middleware/none")
    async def none() -> Payload:
        return p.small

    @routes.get("/middleware/four", dependencies=layers(4))
    async def four() -> Payload:
        return p.small

    @routes.get("/middleware/sixteen", dependencies=layers(16))
    async def sixteen() -> Payload:
        return p.small

    return routes
