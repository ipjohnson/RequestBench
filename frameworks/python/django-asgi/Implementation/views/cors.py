from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from serial import fresh

# cors: CorsMiddleware answers a preflight before any view runs, and adds its headers to the answer
# of the request itself, on the paths settings.py's CORS_URLS_REGEX matches. The view writes
# x-rb-serial, so its absence on a preflight shows the middleware answered alone.
P = settings.PAYLOADS


# rb:handler cors.request,cors.vary
@require_GET
async def small(request):
    return fresh(JsonResponse(P.small))
