from django.utils.encoding import smart_str
from rest_framework.renderers import BaseRenderer


# rb:wiring baseline.*
class PlainTextRenderer(BaseRenderer):
    """A string as it is, typed text/plain. DRF ships no plain-text renderer, and this is the one its
    renderer guide writes as the example of a custom renderer."""

    media_type = "text/plain"
    format = "txt"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return smart_str(data, encoding=self.charset)


# rb:wiring sse.*
class EventStreamRenderer(BaseRenderer):
    """What lets a request that accepts only text/event-stream past DRF's content negotiation, which
    refuses a type no renderer of the view offers with 406. The view answers with a
    StreamingHttpResponse, which DRF sends on unrendered, so this renderer writes nothing itself."""

    media_type = "text/event-stream"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return b""
