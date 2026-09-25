from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response

from answers import echoed

# parameters: path captures, each converted to an int by the <int:...> converter urls.py names. DRF
# hands the view the captures Django's router made.
P = settings.PAYLOADS


# rb:handler parameters.static
@api_view(["GET"])
def static(request):
    return Response(P.small)


# rb:handler parameters.one
@api_view(["GET"])
def one(request, one: int):
    return Response(echoed(P.small, {"one": one}))


# rb:handler parameters.two
@api_view(["GET"])
def two(request, one: int, two: int):
    return Response(echoed(P.small, {"one": one, "two": two}))
