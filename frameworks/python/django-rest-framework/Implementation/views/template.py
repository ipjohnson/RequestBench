from django.conf import settings
from rest_framework.decorators import api_view, renderer_classes
from rest_framework.renderers import TemplateHTMLRenderer
from rest_framework.response import Response

# template: the payload rendered by DRF's TemplateHTMLRenderer, which renders the template the
# Response names with Django's own template language, through the TEMPLATES setting.
P = settings.PAYLOADS


# rb:handler template.small
@api_view(["GET"])
@renderer_classes([TemplateHTMLRenderer])
def small(request):
    return Response(P.small, template_name="items.html")


# rb:handler template.medium
@api_view(["GET"])
@renderer_classes([TemplateHTMLRenderer])
def medium(request):
    return Response(P.medium, template_name="items.html")
