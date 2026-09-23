from django.conf import settings
from django.http import JsonResponse
# rb:wiring cache.*
from django.views.decorators.cache import cache_page
from django.views.decorators.http import require_GET
from django.views.decorators.vary import vary_on_headers

from serial import fresh

# cache: the view skipped and a stored answer written back. cache_page is CacheMiddleware scoped to
# one view: it answers from the store before the view runs, and stores what the view answered. The
# view writes x-rb-serial, so a replayed answer repeats the serial it was stored with.
P = settings.PAYLOADS
# rb:wiring cache.*
TTL = P.settings["cache"]["ttlSeconds"]
ONE = tuple(P.settings["cache"]["vary"]["one"])
MANY = tuple(P.settings["cache"]["vary"]["many"])
# rb:end


# rb:handler cache.small
@require_GET
@cache_page(TTL)
async def small(request):
    return fresh(JsonResponse(P.small))


# rb:handler cache.medium
@require_GET
@cache_page(TTL)
async def medium(request):
    return fresh(JsonResponse(P.medium))


# rb:handler cache.large
@require_GET
@cache_page(TTL)
async def large(request):
    return fresh(JsonResponse(P.large))


# vary_on_headers writes Vary, and cache_page keys the stored answer on the path and on the values
# of the request headers Vary names.
# rb:handler cache.vary_one
@require_GET
@cache_page(TTL)
@vary_on_headers(*ONE)
async def vary_one(request):
    return fresh(JsonResponse(P.small))


# rb:handler cache.vary_many
@require_GET
@cache_page(TTL)
@vary_on_headers(*MANY)
async def vary_many(request):
    return fresh(JsonResponse(P.small))
