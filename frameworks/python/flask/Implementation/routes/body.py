from typing import Annotated, Any

from flask import Blueprint, request
# rb:wiring body.*
from flask_pydantic import validate
from pydantic import Field, ValidationError, create_model, model_validator

from models import Camel
from payloads import Json, Payloads


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
    """The rules orderRequest states. As a view's body parameter, Flask-Pydantic's validate
    decorator checks the body against it before the view runs, and answers 400 with every rule the
    body breaks."""

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


class FirstError(Order):
    """The order, bound with its types once every rule has passed. Validation raises Pydantic's
    error holding the first failure alone, which Flask-Pydantic answers as it answers any other."""

    @model_validator(mode="before")
    @classmethod
    def stop_at_first(cls, data: Any) -> Any:
        for check in ONE_FIELD_AT_A_TIME:
            try:
                check.model_validate(data)
            except ValidationError as error:
                first = error.errors(include_url=False)[0]
                raise ValidationError.from_exception_data(cls.__name__, [first]) from None
        return data
# rb:end


def bound(order: Order) -> Json:
    """What a bind or validate row answers: the order back, with the leaves the view found in it
    and the bytes it received. customerId and status, and a productId and a qty per line."""
    return {"fields": 2 + 2 * len(order.lines), "bytes": request.content_length, "echo": order.model_dump()}


def blueprint(p: Payloads) -> Blueprint:
    """body: the order parsed by Flask and bound by Pydantic through Flask-Pydantic on every route,
    and checked against its rules on the validate routes. A body that is not JSON is refused by
    Flask before any model runs."""
    routes = Blueprint("body", __name__)

    @routes.post("/body/bind/small")
    @validate()
    def bind_small(body: Order) -> Json:
        return bound(body)

    @routes.post("/body/bind/medium")
    @validate()
    def bind_medium(body: Order) -> Json:
        return bound(body)

    @routes.post("/body/validate/small")
    @validate()
    def validate_small(body: CheckedOrder) -> Json:
        return bound(body)

    @routes.post("/body/validate/medium")
    @validate()
    def validate_medium(body: CheckedOrder) -> Json:
        return bound(body)

    @routes.post("/body/validate/first-error")
    @validate()
    def validate_first_error(body: FirstError) -> Json:
        return bound(body)

    return routes
