from typing import Annotated

from pydantic import Field, ValidationError, create_model, model_validator
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import BaseRoute, Route

from payloads import Payloads
from validation import Camel, spec


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
    """The rules orderRequest states. SpecTree validates the body against it before the endpoint
    runs, and answers 422 with every rule the body breaks."""

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


class FirstFailure(Order):
    """The order, refused with the first rule it breaks. The failure is raised as this model's own
    ValidationError, so SpecTree answers it as it answers any other."""

    @model_validator(mode="wrap")
    @classmethod
    def stop_at_first(cls, data, handler):
        for check in ONE_FIELD_AT_A_TIME:
            try:
                check.model_validate(data)
            except ValidationError as error:
                first = error.errors()[0]
                detail = {key: first[key] for key in ("type", "loc", "input", "ctx") if key in first}
                raise ValidationError.from_exception_data(cls.__name__, [detail]) from None
        return handler(data)
# rb:end


def bound(request: Request) -> JSONResponse:
    """What a bind or validate row answers: the order back, with the leaves the endpoint found in it
    and the bytes it received. customerId and status, and a productId and a qty per line."""
    order = request.context.json
    return JSONResponse({
        "fields": 2 + 2 * len(order.lines),
        "bytes": int(request.headers.get("content-length", 0)),
        "echo": order.model_dump(),
    })


def routes(p: Payloads) -> list[BaseRoute]:
    """body: the order parsed by Starlette and bound by SpecTree on every route, and checked against
    its rules on the validate routes. A body that is not JSON is refused before any model runs."""

    # rb:handler body.bind_small
    @spec.validate(json=Order)
    async def bind_small(request: Request) -> JSONResponse:
        """
        requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/Order"}}}}
        responses:
          200: {description: The order bound, content: {application/json: {schema: {$ref: "#/components/schemas/Bound"}}}}
          422: {$ref: "#/components/responses/Refused"}
        """
        return bound(request)

    # rb:handler body.bind_medium
    @spec.validate(json=Order)
    async def bind_medium(request: Request) -> JSONResponse:
        """
        requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/Order"}}}}
        responses:
          200: {description: The order bound, content: {application/json: {schema: {$ref: "#/components/schemas/Bound"}}}}
          422: {$ref: "#/components/responses/Refused"}
        """
        return bound(request)

    # rb:handler body.validate_small,body.rejected_all,errors.malformed
    @spec.validate(json=CheckedOrder)
    async def validate_small(request: Request) -> JSONResponse:
        """
        requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/CheckedOrder"}}}}
        responses:
          200: {description: The order bound and checked, content: {application/json: {schema: {$ref: "#/components/schemas/Bound"}}}}
          422: {$ref: "#/components/responses/Refused"}
        """
        return bound(request)

    # rb:handler body.validate_medium
    @spec.validate(json=CheckedOrder)
    async def validate_medium(request: Request) -> JSONResponse:
        """
        requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/CheckedOrder"}}}}
        responses:
          200: {description: The order bound and checked, content: {application/json: {schema: {$ref: "#/components/schemas/Bound"}}}}
          422: {$ref: "#/components/responses/Refused"}
        """
        return bound(request)

    # rb:handler body.rejected_first
    @spec.validate(json=FirstFailure)
    async def validate_first_error(request: Request) -> JSONResponse:
        """
        requestBody: {required: true, content: {application/json: {schema: {$ref: "#/components/schemas/CheckedOrder"}}}}
        responses:
          200: {description: The order bound and checked, content: {application/json: {schema: {$ref: "#/components/schemas/Bound"}}}}
          422: {$ref: "#/components/responses/Refused"}
        """
        return bound(request)

    return [
        Route("/body/bind/small", bind_small, methods=["POST"]),
        Route("/body/bind/medium", bind_medium, methods=["POST"]),
        Route("/body/validate/small", validate_small, methods=["POST"]),
        Route("/body/validate/medium", validate_medium, methods=["POST"]),
        Route("/body/validate/first-error", validate_first_error, methods=["POST"]),
    ]
