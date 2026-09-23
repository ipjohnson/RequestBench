from django.conf import settings
from django.shortcuts import render
from django.views.decorators.http import require_GET

# template: the payload rendered by Django's own template language, through the TEMPLATES setting.
P = settings.PAYLOADS


# rb:handler template.small
@require_GET
async def small(request):
    return render(request, "items.html", P.small)


# rb:handler template.medium
@require_GET
async def medium(request):
    return render(request, "items.html", P.medium)
