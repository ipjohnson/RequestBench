from typing import Annotated

from litestar import Router, get
from litestar.params import HeaderParameter

from answers import Echoed
from payloads import Camel, Payload, Payloads


class HeadersBound(Camel):
    tenant: str
    request_id: str
    account: int


def router(p: Payloads) -> Router:
    """headers: /headers reads no header, and /headers/bind binds three, each named by HeaderParameter,
    the account as an int."""

    @get("/headers")
    async def unread() -> Payload:
        return p.small

    @get("/headers/bind")
    async def bind(tenant: Annotated[str, HeaderParameter(name="x-rb-tenant")],
                   request_id: Annotated[str, HeaderParameter(name="x-rb-request-id")],
                   account: Annotated[int, HeaderParameter(name="x-rb-account")]) -> Echoed[HeadersBound]:
        return Echoed[HeadersBound].of(p.small, HeadersBound(tenant=tenant, request_id=request_id, account=account))

    return Router(path="/", route_handlers=[unread, bind])
