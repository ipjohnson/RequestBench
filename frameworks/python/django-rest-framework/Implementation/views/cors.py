from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response

from serial import fresh

# cors: CorsMiddleware answers a preflight before any view runs, and adds its headers to the answer
# of the request itself, on the paths settings.py's CORS_URLS_REGEX matches. DRF's documentation
# leaves CORS to this middleware. The view writes x-rb-serial, so its absence on a preflight shows
# the middleware answered alone.
P = settings.PAYLOADS


# rb:handler cors.request,cors.vary
@api_view(["GET"])
def small(request):
    return fresh(Response(P.small))
