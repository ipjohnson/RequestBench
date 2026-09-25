from django.conf import settings
from django.utils.decorators import decorator_from_middleware
from django.utils.deprecation import MiddlewareMixin
from rest_framework.decorators import api_view
from rest_framework.response import Response

P = settings.PAYLOADS


# rb:wiring middleware.*
class Noop(MiddlewareMixin):
    """One layer. Returning None from process_request carries the request on to the next layer."""

    def process_request(self, request):
        return None


def layers(count: int):
    """DRF has no middleware of its own, and a DRF view is a Django view. decorator_from_middleware
    is how Django scopes a middleware to one view, so each layer is Noop made into a view decorator,
    on the function @api_view wraps, as DRF's caching guide places cache_page."""
    layer = decorator_from_middleware(Noop)

    def wrap(view):
        for _ in range(count):
            view = layer(view)
        return view

    return wrap
# rb:end


# middleware: no-op layers in front of the view.
# rb:handler middleware.none
@api_view(["GET"])
def none(request):
    return Response(P.small)


# rb:handler middleware.four
@api_view(["GET"])
@layers(4)
def four(request):
    return Response(P.small)


# rb:handler middleware.sixteen
@api_view(["GET"])
@layers(16)
def sixteen(request):
    return Response(P.small)
