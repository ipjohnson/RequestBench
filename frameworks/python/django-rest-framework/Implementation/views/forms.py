from django.conf import settings
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

from answers import echoed
from views.query import Search

# forms: the same eight values query.many reads, from a urlencoded body, and an upload. DRF's
# FormParser and MultiPartParser parse both into request.data, and a Serializer binds them.
P = settings.PAYLOADS


class Upload(serializers.Serializer):
    """What forms.multipart posts: two fields and a file."""

    tenant = serializers.CharField()
    requestId = serializers.CharField()
    file = serializers.FileField()


# rb:handler forms.urlencoded
@api_view(["POST"])
def urlencoded(request):
    search = Search(data=request.data)
    search.is_valid(raise_exception=True)
    return Response(echoed(P.small, search.validated_data))


# rb:handler forms.multipart
@api_view(["POST"])
def multipart(request):
    upload = Upload(data=request.data)
    upload.is_valid(raise_exception=True)
    file = upload.validated_data["file"]
    return Response({"file": {"name": file.name, "bytes": file.size},
                     "echo": {"tenant": upload.validated_data["tenant"], "requestId": upload.validated_data["requestId"]}})
