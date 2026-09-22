from typing import Annotated

from fastapi import APIRouter, Header

from answers import Echoed
from payloads import Camel, Payload, Payloads


class HeadersBound(Camel):
    tenant: str
    request_id: str
    account: int


def router(p: Payloads) -> APIRouter:
    """headers: /headers reads no header, and /headers/bind binds three, reading each by its
    parameter's name with hyphens for underscores, the account as an int."""
    routes = APIRouter()

    @routes.get("/headers")
    async def unread() -> Payload:
        return p.small

    @routes.get("/headers/bind")
    async def bind(x_rb_tenant: Annotated[str, Header()], x_rb_request_id: Annotated[str, Header()],
                   x_rb_account: Annotated[int, Header()]) -> Echoed[HeadersBound]:
        return Echoed[HeadersBound].of(p.small, HeadersBound(tenant=x_rb_tenant, request_id=x_rb_request_id, account=x_rb_account))

    return routes
