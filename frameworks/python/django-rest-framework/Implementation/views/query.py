from django.conf import settings
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

from answers import echoed

# query: the query string bound by a Serializer over request.query_params, which is DRF's binder as
# well as its validator. Each field converts its value, so validated_data is already the echo, and a
# value a field refuses is DRF's own 400.
P = settings.PAYLOADS


class Page(serializers.Serializer):
    page = serializers.IntegerField()


class Search(serializers.Serializer):
    """query.many's eight values, which forms.urlencoded posts as a form."""

    page = serializers.IntegerField()
    size = serializers.IntegerField()
    status = serializers.CharField()
    category = serializers.CharField()
    sort = serializers.CharField()
    q = serializers.CharField()
    minPrice = serializers.IntegerField()
    maxPrice = serializers.IntegerField()


# rb:handler query.one
@api_view(["GET"])
def one(request):
    page = Page(data=request.query_params)
    page.is_valid(raise_exception=True)
    return Response(echoed(P.small, page.validated_data))


# rb:handler query.many
@api_view(["GET"])
def many(request):
    search = Search(data=request.query_params)
    search.is_valid(raise_exception=True)
    return Response(echoed(P.small, search.validated_data))
