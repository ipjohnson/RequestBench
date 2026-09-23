import json

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.http import StreamingHttpResponse
from django.views.decorators.http import require_GET

# sse: items.medium's rows as server-sent events. Django has no event stream of its own, so the view
# frames each row as one event and streams it, as the stream family streams its lines.
P = settings.PAYLOADS


# rb:handler sse.medium
@require_GET
async def medium(request):
    async def events():
        for row in P.medium["items"]:
            yield f"data: {json.dumps(row, cls=DjangoJSONEncoder)}\n\n"

    return StreamingHttpResponse(events(), content_type="text/event-stream")
