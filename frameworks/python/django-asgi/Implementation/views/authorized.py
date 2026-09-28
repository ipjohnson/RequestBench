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
    Authorization header and raises PermissionDenied for any but the one it names, which Django
    answers with its own 403 before the view runs. A request with no token is refused the same way."""
    @wraps(view)
    async def guarded(request, *args, **kwargs):
        scheme, _, credentials = request.headers.get("authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not constant_time_compare(credentials, "5a7cc77ed0dcb825806b6f872026c317"):
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
