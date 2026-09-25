from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from answers import echoed

# headers: /headers reads no header, and /headers/bind reads three. DRF binds no header, so the view
# reads each from request.headers by name and converts the account itself. A header that is missing
# or no int is DRF's own ValidationError.
P = settings.PAYLOADS


# rb:handler headers.few,headers.many
@api_view(["GET"])
def unread(request):
    return Response(P.small)


# rb:handler headers.bind_few,headers.bind_many
@api_view(["GET"])
def bind(request):
    headers = request.headers
    try:
        echo = {"tenant": headers["x-rb-tenant"], "requestId": headers["x-rb-request-id"], "account": int(headers["x-rb-account"])}
    except (KeyError, ValueError) as error:
        raise ValidationError(f"a bound header is missing or no int: {error}") from None
    return Response(echoed(P.small, echo))
