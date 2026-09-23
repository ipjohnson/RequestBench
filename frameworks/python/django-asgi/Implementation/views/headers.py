from django.conf import settings
from django.core.exceptions import BadRequest
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from answers import echoed

# headers: /headers reads no header, and /headers/bind reads three. Django binds no header, so the
# view reads each from request.headers by name and converts the account itself. A header that is
# missing or no int is Django's own BadRequest.
P = settings.PAYLOADS


# rb:handler headers.few,headers.many
@require_GET
async def unread(request):
    return JsonResponse(P.small)


# rb:handler headers.bind_few,headers.bind_many
@require_GET
async def bind(request):
    headers = request.headers
    try:
        echo = {"tenant": headers["x-rb-tenant"], "requestId": headers["x-rb-request-id"], "account": int(headers["x-rb-account"])}
    except (KeyError, ValueError) as error:
        raise BadRequest(f"a bound header is missing or no int: {error}") from None
    return JsonResponse(echoed(P.small, echo))
