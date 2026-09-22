from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.exceptions import RequestValidationError
# rb:wiring body.*
from pydantic import Field, ValidationError, create_model

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
Positive = Annotated[int, Field(gt=0)]


class CheckedLine(Line):
    product_id: Positive
    qty: Positive


class CheckedOrder(Order):
    """The rules orderRequest states. As a route's body parameter, FastAPI validates the body
    against it before the handler runs, and answers 422 with every rule the body breaks."""

    customer_id: Positive
    status: Annotated[str, Field(min_length=1)]
    lines: Annotated[list[CheckedLine], Field(min_length=1)]


# Pydantic reports every rule a body breaks and cannot stop at the first, so the first-error route
# is wired by hand. It checks CheckedOrder's fields in the order they are declared, each as a model
# of that one field, and stops at the first that fails.
ONE_FIELD_AT_A_TIME = tuple(
    create_model(f"Checked_{name}", __base__=Camel, **{name: (field.annotation, field)})
    for name, field in CheckedOrder.model_fields.items()
)


async def stop_at_first(request: Request) -> None:
    """Raises FastAPI's own validation error, holding Pydantic's first failure. FastAPI has parsed
    the body before any dependency runs, and Starlette keeps what it parsed."""
    body = await request.json()
    for check in ONE_FIELD_AT_A_TIME:
        try:
            check.model_validate(body)
        except ValidationError as error:
            first = error.errors(include_url=False)[0]
            raise RequestValidationError([{**first, "loc": ("body", *first["loc"])}]) from None
# rb:end


class Bound(Camel):
    """What a bind or validate row answers: the order back, with the leaves the handler found in it
    and the bytes it received."""

    fields: int
    bytes: int
    echo: Order

    @classmethod
    def of(cls, order: Order, request: Request) -> "Bound":
        # customerId and status, and a productId and a qty per line.
        return cls(fields=2 + 2 * len(order.lines), bytes=int(request.headers.get("content-length", 0)), echo=order)


def router(p: Payloads) -> APIRouter:
    """body: the order parsed by FastAPI and bound by Pydantic on every route, and checked against
    its rules on the validate routes. A body that is not JSON is refused before any model runs."""
    routes = APIRouter()

    @routes.post("/body/bind/small")
    async def bind_small(order: Order, request: Request) -> Bound:
        return Bound.of(order, request)

    @routes.post("/body/bind/medium")
    async def bind_medium(order: Order, request: Request) -> Bound:
        return Bound.of(order, request)

    @routes.post("/body/validate/small")
    async def validate_small(order: CheckedOrder, request: Request) -> Bound:
        return Bound.of(order, request)

    @routes.post("/body/validate/medium")
    async def validate_medium(order: CheckedOrder, request: Request) -> Bound:
        return Bound.of(order, request)

    # The dependency has checked every rule by the time the order is bound.
    @routes.post("/body/validate/first-error", dependencies=[Depends(stop_at_first)])
    async def validate_first_error(order: Order, request: Request) -> Bound:
        return Bound.of(order, request)

    return routes
