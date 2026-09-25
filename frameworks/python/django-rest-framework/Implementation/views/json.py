from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response

# json: a payload the framework already holds, rendered by DRF's JSONRenderer on every request.
# Three static routes rather than one with a capture, so the router pays no capture here.
P = settings.PAYLOADS


# rb:handler json.small,cors.scoped
@api_view(["GET"])
def small(request):
    return Response(P.small)


# rb:handler json.medium
@api_view(["GET"])
def medium(request):
    return Response(P.medium)


# rb:handler json.large
@api_view(["GET"])
def large(request):
    return Response(P.large)
