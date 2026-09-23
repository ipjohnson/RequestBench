from functools import wraps
from typing import Annotated

# rb:wiring body.*
from pydantic import Field, ValidationError, create_model
from sanic import Blueprint
from sanic.response import json
from sanic_ext import openapi, validate
from sanic_ext.extras.validation.validators import validate_body

from documented import answers, refuses
from models import Camel
from payloads import Json, Payloads


class Line(Camel):
    product_id: int
    qty: int


@openapi.component
class Order(Camel):
    """The body the bind and validate rows send, bound with its types and none of its rules."""

    customer_id: int
    status: str
    lines: list[Line]


# rb:wiring body.*
# sanic-ext's validation guide leads with dataclasses, which state a field's type and no rule, such
# as a minimum. It validates a Pydantic model too, and Pydantic states the rules.
Positive = Annotated[int, Field(gt=0)]


class CheckedLine(Line):
    product_id: Positive
    qty: Positive


# As @validate's json model, sanic-ext validates the body against it before the handler runs, and a
# body that breaks any rule is sanic-ext's ValidationError, which Sanic answers with 400 and
# Pydantic's account of every failure.
@openapi.component
class CheckedOrder(Order):
    """The order, with the rules orderRequest states."""

    customer_id: Positive
    status: Annotated[str, Field(min_length=1)]
    lines: Annotated[list[CheckedLine], Field(min_length=1)]


# Pydantic reports every rule a body breaks and cannot stop at the first, so the first-error route
# is wired by hand. It checks CheckedOrder's fields in the order they are declared, each as a model
# of that one field, also named CheckedOrder, and stops at the first that fails.
ONE_FIELD_AT_A_TIME = tuple(
    create_model("CheckedOrder", __base__=Camel, **{name: (field.annotation, field)})
    for name, field in CheckedOrder.model_fields.items()
)


def first_failure(model, body):
    """model_validate, raising Pydantic's error with its first failure alone. One field can hold
    several, such as two lines that each break a rule."""
    try:
        return model.model_validate(body)
    except ValidationError as error:
        raise ValidationError.from_exception_data(error.title, error.errors(include_url=False)[:1]) from None


def stop_at_first(handler):
    """Runs each check through sanic-ext's own validate_body, which raises the ValidationError
    @validate would, holding the first failure."""

    @wraps(handler)
    async def checked(request, *args, **kwargs):
        for check in ONE_FIELD_AT_A_TIME:
            validate_body(first_failure, check, request.json)
        return await handler(request, *args, **kwargs)

    return checked
# rb:end


class Bound(Camel):
    """What a bind or validate row answers, as the document states it."""

    fields: int
    bytes: int
    echo: Order


def bound(order: Order, request) -> Json:
    """What a bind or validate row answers: the order back, with the leaves the handler found in it
    and the bytes it received."""
    # customerId and status, and a productId and a qty per line.
    return {"fields": 2 + 2 * len(order.lines), "bytes": len(request.body), "echo": order.model_dump()}


def blueprint(p: Payloads) -> Blueprint:
    """body: the order parsed by Sanic and bound by Pydantic through sanic-ext's @validate on every
    route, and checked against its rules on the validate routes. A body that is not JSON is Sanic's
    own 400, raised as @validate reads it."""
    routes = Blueprint("body")

    @routes.post("/body/bind/small")
    @answers(Bound, "The order back, with its leaves and length")
    @validate(json=Order)
    async def bind_small(request, body: Order):
        """Binds the order and checks no rule.

        openapi:
        ---
        requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/Order"}}}}
        """
        return json(bound(body, request))

    @routes.post("/body/bind/medium")
    @answers(Bound, "The order back, with its leaves and length")
    @validate(json=Order)
    async def bind_medium(request, body: Order):
        """Binds the order and checks no rule.

        openapi:
        ---
        requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/Order"}}}}
        """
        return json(bound(body, request))

    @routes.post("/body/validate/small")
    @answers(Bound, "The order back, with its leaves and length")
    @refuses(400, "sanic-ext's refusal, naming every rule the order breaks")
    @validate(json=CheckedOrder)
    async def validate_small(request, body: CheckedOrder):
        """Binds the order and checks orderRequest's rules.

        openapi:
        ---
        requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/CheckedOrder"}}}}
        """
        return json(bound(body, request))

    @routes.post("/body/validate/medium")
    @answers(Bound, "The order back, with its leaves and length")
    @refuses(400, "sanic-ext's refusal, naming every rule the order breaks")
    @validate(json=CheckedOrder)
    async def validate_medium(request, body: CheckedOrder):
        """Binds the order and checks orderRequest's rules.

        openapi:
        ---
        requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/CheckedOrder"}}}}
        """
        return json(bound(body, request))

    # The checks have passed by the time the order is bound.
    @routes.post("/body/validate/first-error")
    @answers(Bound, "The order back, with its leaves and length")
    @refuses(400, "sanic-ext's refusal, naming the first rule the order breaks")
    @stop_at_first
    @validate(json=Order)
    async def validate_first_error(request, body: Order):
        """Checks orderRequest's rules one field at a time and stops at the first that fails.

        openapi:
        ---
        requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/CheckedOrder"}}}}
        """
        return json(bound(body, request))

    return routes
