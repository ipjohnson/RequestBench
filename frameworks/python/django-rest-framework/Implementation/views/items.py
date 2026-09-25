from django.conf import settings
from rest_framework import serializers, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.reverse import reverse

from payloads import Json

# items: every method on one resource over the rows of items.large. A measured row may not leave
# the server changed, so the writes store nothing and answer as if they had written.
P = settings.PAYLOADS
CREATED = P.large["count"] + 1


class NewItem(serializers.Serializer):
    """An item as a client creates or replaces one. A patch binds it with partial=True, as DRF's own
    partial_update does, which leaves out every field the patch does not send."""

    name = serializers.CharField()
    category = serializers.CharField()
    priceCents = serializers.IntegerField()
    inStock = serializers.BooleanField()


class Items(viewsets.ViewSet):
    """The resource as one ViewSet, which urls.py's SimpleRouter routes. POST on /items is create,
    and GET, PUT, PATCH and DELETE on /items/<int:pk> are retrieve, update, partial_update and
    destroy. DRF answers HEAD with retrieve, and a method with no action with 405. A missing row is
    DRF's NotFound."""

    lookup_value_converter = "int"

    # rb:handler items.create
    def create(self, request):
        item = NewItem(data=request.data)
        item.is_valid(raise_exception=True)
        location = reverse("item-detail", kwargs={"pk": CREATED}, request=request)
        return Response({"id": CREATED, **item.validated_data}, status=201, headers={"Location": location})

    # rb:handler items.read,items.head
    # rb:handler errors.not_found
    def retrieve(self, request, pk: int):
        return Response(row(pk))

    # rb:handler items.replace
    def update(self, request, pk: int):
        item = NewItem(data=request.data)
        item.is_valid(raise_exception=True)
        return Response({"id": pk, **item.validated_data})

    # rb:handler items.update
    def partial_update(self, request, pk: int):
        found = row(pk)
        patch = NewItem(data=request.data, partial=True)
        patch.is_valid(raise_exception=True)
        return Response(found | patch.validated_data)

    # rb:handler items.delete
    def destroy(self, request, pk: int):
        row(pk)
        return Response(status=204)


def row(pk: int) -> Json:
    """The row with this id, or DRF's NotFound, which it answers with 404."""
    found = P.row(pk)
    if found is None:
        raise NotFound
    return found
