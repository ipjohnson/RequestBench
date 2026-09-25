from django.conf import settings
from django.utils.crypto import constant_time_compare
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

P = settings.PAYLOADS


# rb:wiring authorized.*
class BearerToken(BasePermission):
    """A permission class is how DRF refuses a request before the view runs, and a refusal from one
    is DRF's 403. This one compares the bearer token with settings.json's. DRF's TokenAuthentication
    looks its tokens up in a database table and answers a wrong one with 401. A request with no token
    is refused the same way as a wrong one."""

    def has_permission(self, request, view):
        scheme, _, credentials = request.headers.get("authorization", "").partition(" ")
        return scheme.lower() == "bearer" and constant_time_compare(credentials, P.settings["token"])
# rb:end


# authorized: the permission class checks the token before the view runs.
# rb:handler authorized.allowed,authorized.denied
@api_view(["GET"])
@permission_classes([BearerToken])
def small(request):
    return Response(P.small)
