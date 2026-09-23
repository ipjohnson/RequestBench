from typing import Annotated

from litestar import Request, Router, post
# rb:wiring body.*
from msgspec import Meta

from payloads import Camel, Payloads


class Line(Camel):
    product_id: int
    qty: int


class Order(Camel):
    """The body the bind and validate rows send, bound with its types and none of its rules."""

    customer_id: int
    status: str
    lines: list[Line]


# rb:wiring body.*
Positive = Annotated[int, Meta(gt=0)]


class CheckedLine(Camel):
    product_id: Positive
    qty: Positive


class CheckedOrder(Camel):
    """The rules orderRequest states, as msgspec constraints. As a handler's data parameter, Litestar
    converts the body to it before the handler runs, and answers 400 with the first rule the body
    breaks: msgspec stops at the first failure."""

    customer_id: Positive
    status: Annotated[str, Meta(min_length=1)]
    lines: Annotated[list[CheckedLine], Meta(min_length=1)]
# rb:end


class Bound[O](Camel):
    """What a bind or validate row answers: the order back, with the leaves the handler found in it
    and the bytes it received."""

    fields: int
    bytes: int
    echo: O

    @classmethod
    def of(cls, order: O, request: Request) -> "Bound[O]":
        # customerId and status, and a productId and a qty per line.
        return cls(fields=2 + 2 * len(order.lines), bytes=int(request.headers.get("content-length", 0)), echo=order)


def router(p: Payloads) -> Router:
    """body: the order decoded by Litestar and converted by msgspec on every route, and checked
    against its rules on the validate routes. A body that is not JSON is refused before any Struct
    is built. POST answers 201 by default in Litestar, so each route says 200."""

    @post("/body/bind/small", status_code=200)
    async def bind_small(data: Order, request: Request) -> Bound[Order]:
        return Bound[Order].of(data, request)

    @post("/body/bind/medium", status_code=200)
    async def bind_medium(data: Order, request: Request) -> Bound[Order]:
        return Bound[Order].of(data, request)

    @post("/body/validate/small", status_code=200)
    async def validate_small(data: CheckedOrder, request: Request) -> Bound[CheckedOrder]:
        return Bound[CheckedOrder].of(data, request)

    @post("/body/validate/medium", status_code=200)
    async def validate_medium(data: CheckedOrder, request: Request) -> Bound[CheckedOrder]:
        return Bound[CheckedOrder].of(data, request)

    # The same Struct as the validate routes, because msgspec already stops at the first failure.
    @post("/body/validate/first-error", status_code=200)
    async def validate_first_error(data: CheckedOrder, request: Request) -> Bound[CheckedOrder]:
        return Bound[CheckedOrder].of(data, request)

    return Router(path="/", route_handlers=[bind_small, bind_medium, validate_small, validate_medium, validate_first_error])
