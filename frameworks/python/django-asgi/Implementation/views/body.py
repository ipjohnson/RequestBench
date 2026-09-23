import json
from typing import Any

from django import forms
from django.core.exceptions import BadRequest, ValidationError
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_POST


def parsed(request: HttpRequest) -> dict[str, Any]:
    """The body as a JSON object. Django parses no JSON, so the view does, and a body that is not
    one is Django's own BadRequest, which it answers with 400 before any form runs."""
    try:
        order = json.loads(request.body)
    except ValueError as error:
        raise BadRequest(f"the body is not JSON: {error}") from None
    if not isinstance(order, dict):
        raise BadRequest("the body is not a JSON object")
    return order


# rb:wiring body.*
class LineForm(forms.Form):
    productId = forms.IntegerField(min_value=1)
    qty = forms.IntegerField(min_value=1)


class OrderForm(forms.Form):
    """The rules orderRequest states, as a django.forms.Form. is_valid() runs every field's checks
    and collects each failure in form.errors, keyed by the field's name."""

    customerId = forms.IntegerField(min_value=1)
    status = forms.CharField()
    # A form is flat, so the lines arrive as one value, and clean_lines holds each to LineForm.
    lines = forms.JSONField()

    def clean_lines(self) -> list[Any]:
        lines = self.cleaned_data["lines"]
        if not isinstance(lines, list):
            raise ValidationError("Enter a list of lines.", code="invalid")
        failures = []
        for index, line in enumerate(lines):
            if not isinstance(line, dict):
                failures.append(ValidationError("Line %(index)s is not an object.", code="invalid", params={"index": index}))
                continue
            form = LineForm(line)
            if not form.is_valid():
                failures.extend(
                    ValidationError("%(field)s on line %(index)s: %(message)s", code=error.code,
                                    params={"field": field, "index": index, "message": message})
                    for field, errors in form.errors.as_data().items()
                    for error in errors
                    for message in error
                )
        if failures:
            raise ValidationError(failures)
        return lines
# rb:end


def bound(order: dict[str, Any], request: HttpRequest) -> JsonResponse:
    """What a bind or validate row answers: the order back, with the leaves the view found in it and
    the bytes it received."""
    # customerId and status, and a productId and a qty per line.
    return JsonResponse({"fields": 2 + 2 * len(order.get("lines", ())), "bytes": len(request.body), "echo": order})


# body: the order parsed by the view on every route, and held to OrderForm on the validate routes. A
# form that fails answers with its errors, as Django's documentation answers a form posted by fetch.
# rb:handler body.bind_small
@require_POST
async def bind_small(request):
    return bound(parsed(request), request)


# rb:handler body.bind_medium
@require_POST
async def bind_medium(request):
    return bound(parsed(request), request)


# rb:handler body.validate_small,body.rejected_all,errors.malformed
@require_POST
async def validate_small(request):
    form = OrderForm(parsed(request))
    if not form.is_valid():
        return JsonResponse(form.errors, status=400)
    return bound(form.cleaned_data, request)


# rb:handler body.validate_medium
@require_POST
async def validate_medium(request):
    form = OrderForm(parsed(request))
    if not form.is_valid():
        return JsonResponse(form.errors, status=400)
    return bound(form.cleaned_data, request)


# rb:wiring body.*
# A form collects every failure and cannot stop at the first, so this route is wired by hand. It
# holds the order to OrderForm one field at a time, in the order the fields are declared, each time
# as the form with that one field, and answers the first form that fails as the full check would.
# rb:handler body.rejected_first
@require_POST
async def validate_first_error(request):
    order = parsed(request)
    cleaned: dict[str, Any] = {}
    for name in OrderForm.base_fields:
        form = OrderForm(order)
        form.fields = {name: form.fields[name]}
        if not form.is_valid():
            return JsonResponse(form.errors, status=400)
        cleaned |= form.cleaned_data
    return bound(cleaned, request)
