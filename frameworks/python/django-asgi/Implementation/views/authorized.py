from functools import wraps

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.http import JsonResponse
from django.utils.crypto import constant_time_compare
from django.views.decorators.http import require_GET

P = settings.PAYLOADS


# rb:wiring authorized.*
def require_token(view):
    """Django checks no bearer token of its own. This decorator reads the token from the
    Authorization header and raises PermissionDenied for any but settings.json's, which Django
    answers with its own 403 before the view runs. A request with no token is refused the same way."""
    token = P.settings["token"]

    @wraps(view)
    async def guarded(request, *args, **kwargs):
        scheme, _, credentials = request.headers.get("authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not constant_time_compare(credentials, token):
            raise PermissionDenied
        return await view(request, *args, **kwargs)

    return guarded
# rb:end


# authorized: the decorator checks the token before the view runs.
# rb:handler authorized.allowed,authorized.denied
@require_GET
@require_token
async def small(request):
    return JsonResponse(P.small)
