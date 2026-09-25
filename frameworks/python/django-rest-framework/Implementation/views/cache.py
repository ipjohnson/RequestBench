from django.conf import settings
# rb:wiring cache.*
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers
from rest_framework.decorators import api_view
from rest_framework.response import Response

from serial import fresh

# cache: the view skipped and a stored answer written back. DRF has no cache of its own, and its
# caching guide puts Django's cache_page on the function @api_view wraps. cache_page is
# CacheMiddleware scoped to that function: it answers from the store before the function runs, and
# stores the answer once DRF has rendered it. The view writes x-rb-serial, so a replayed answer
# repeats the serial it was stored with.
P = settings.PAYLOADS
# rb:wiring cache.*
TTL = P.settings["cache"]["ttlSeconds"]
ONE = tuple(P.settings["cache"]["vary"]["one"])
MANY = tuple(P.settings["cache"]["vary"]["many"])
# rb:end


# rb:handler cache.small
@api_view(["GET"])
@cache_page(TTL)
def small(request):
    return fresh(Response(P.small))


# rb:handler cache.medium
@api_view(["GET"])
@cache_page(TTL)
def medium(request):
    return fresh(Response(P.medium))


# rb:handler cache.large
@api_view(["GET"])
@cache_page(TTL)
def large(request):
    return fresh(Response(P.large))


# vary_on_headers writes Vary, and cache_page keys the stored answer on the path and on the values
# of the request headers Vary names.
# rb:handler cache.vary_one
@api_view(["GET"])
@cache_page(TTL)
@vary_on_headers(*ONE)
def vary_one(request):
    return fresh(Response(P.small))


# rb:handler cache.vary_many
@api_view(["GET"])
@cache_page(TTL)
@vary_on_headers(*MANY)
def vary_many(request):
    return fresh(Response(P.small))
