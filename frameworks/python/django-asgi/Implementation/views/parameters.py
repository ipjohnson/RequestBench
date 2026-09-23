from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from answers import echoed

# parameters: path captures, each converted to an int by the <int:...> converter urls.py names.
P = settings.PAYLOADS


# rb:handler parameters.static
@require_GET
async def static(request):
    return JsonResponse(P.small)


# rb:handler parameters.one
@require_GET
async def one(request, one: int):
    return JsonResponse(echoed(P.small, {"one": one}))


# rb:handler parameters.two
@require_GET
async def two(request, one: int, two: int):
    return JsonResponse(echoed(P.small, {"one": one, "two": two}))
