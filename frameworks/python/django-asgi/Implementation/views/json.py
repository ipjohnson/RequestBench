from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET

# json: a payload the framework already holds, serialised by JsonResponse on every request. Three
# static routes rather than one with a capture, so the router pays no capture here.
P = settings.PAYLOADS


# rb:handler json.small,cors.scoped
@require_GET
async def small(request):
    return JsonResponse(P.small)


# rb:handler json.medium
@require_GET
async def medium(request):
    return JsonResponse(P.medium)


# rb:handler json.large
@require_GET
async def large(request):
    return JsonResponse(P.large)
