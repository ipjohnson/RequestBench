from django.conf import settings
from django.http import JsonResponse
from django.utils.decorators import decorator_from_middleware
from django.utils.deprecation import MiddlewareMixin
from django.views.decorators.http import require_GET

P = settings.PAYLOADS


# rb:wiring middleware.*
class Noop(MiddlewareMixin):
    """One layer. Returning None from process_request carries the request on to the next layer."""

    def process_request(self, request):
        return None


def layers(count: int):
    """Django's MIDDLEWARE runs on every request. decorator_from_middleware is how Django scopes a
    middleware to one view, as cache_page and gzip_page scope theirs, so each layer is Noop made
    into a view decorator."""
    layer = decorator_from_middleware(Noop)

    def wrap(view):
        for _ in range(count):
            view = layer(view)
        return view

    return wrap
# rb:end


# middleware: no-op layers in front of the view.
# rb:handler middleware.none
@require_GET
async def none(request):
    return JsonResponse(P.small)


# rb:handler middleware.four
@require_GET
@layers(4)
async def four(request):
    return JsonResponse(P.small)


# rb:handler middleware.sixteen
@require_GET
@layers(16)
async def sixteen(request):
    return JsonResponse(P.small)
