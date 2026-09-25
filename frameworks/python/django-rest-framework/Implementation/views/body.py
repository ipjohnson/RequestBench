from collections.abc import Mapping

from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response


class Line(serializers.Serializer):
    productId = serializers.IntegerField()
    qty = serializers.IntegerField()


class Order(serializers.Serializer):
    """The body the bind rows send, bound with its types and none of its rules, so a blank status
    and an empty list of lines both bind."""

    customerId = serializers.IntegerField()
    status = serializers.CharField(allow_blank=True)
    lines = Line(many=True)


# rb:wiring body.*
class CheckedLine(serializers.Serializer):
    productId = serializers.IntegerField(min_value=1)
    qty = serializers.IntegerField(min_value=1)


class CheckedOrder(serializers.Serializer):
    """The rules orderRequest states, as a DRF Serializer. is_valid() runs every field's checks and
    collects each failure, keyed by the field's name, and with raise_exception DRF answers them with
    its 400."""

    customerId = serializers.IntegerField(min_value=1)
    status = serializers.CharField()
    lines = CheckedLine(many=True, allow_empty=False)


class FirstError(CheckedOrder):
    """CheckedOrder, stopped at the first field that fails. A Serializer checks every field and
    reports every failure, so this one overrides to_internal_value, DRF's hook for turning a body
    into validated data. It runs each field's own validation in the order the fields are declared,
    and raises the first failure as DRF raises any. The answer is the entry the full check would have
    listed first."""

    def to_internal_value(self, data):
        if not isinstance(data, Mapping):
            return super().to_internal_value(data)
        order = {}
        for field in self.fields.values():
            try:
                order[field.field_name] = field.run_validation(field.get_value(data))
            except serializers.ValidationError as error:
                raise serializers.ValidationError({field.field_name: error.detail}) from None
        return order
# rb:end


def bound(order: serializers.Serializer, request) -> Response:
    """What a bind or validate row answers: the order back, with the leaves the view found in it and
    the bytes it received. DRF's parser has read the body by now, so its length is the header's."""
    echo = order.validated_data
    # customerId and status, and a productId and a qty per line.
    return Response({"fields": 2 + 2 * len(echo["lines"]), "bytes": int(request.headers["content-length"]), "echo": echo})


# body: the order parsed by DRF's JSONParser into request.data on every route, and bound by a
# Serializer, with its types on the bind routes and orderRequest's rules on the validate routes. A
# body that is not JSON is the parser's ParseError, which DRF answers with 400 before any
# serializer runs.
# rb:handler body.bind_small
@api_view(["POST"])
def bind_small(request):
    order = Order(data=request.data)
    order.is_valid(raise_exception=True)
    return bound(order, request)


# rb:handler body.bind_medium
@api_view(["POST"])
def bind_medium(request):
    order = Order(data=request.data)
    order.is_valid(raise_exception=True)
    return bound(order, request)


# rb:handler body.validate_small,body.rejected_all,errors.malformed
@api_view(["POST"])
def validate_small(request):
    order = CheckedOrder(data=request.data)
    order.is_valid(raise_exception=True)
    return bound(order, request)


# rb:handler body.validate_medium
@api_view(["POST"])
def validate_medium(request):
    order = CheckedOrder(data=request.data)
    order.is_valid(raise_exception=True)
    return bound(order, request)


# rb:handler body.rejected_first
@api_view(["POST"])
def validate_first_error(request):
    order = FirstError(data=request.data)
    order.is_valid(raise_exception=True)
    return bound(order, request)
