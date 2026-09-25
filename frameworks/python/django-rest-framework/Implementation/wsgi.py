"""The application each gunicorn worker loads, and the one apig-wsgi hands each Lambda event to.
Setting Django up reads settings.py, which loads the payloads RB_PAYLOADS names."""
import os

from django.core.wsgi import get_wsgi_application
from django.urls import get_resolver

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")

application = get_wsgi_application()

# Django imports the URLconf, and every view module with it, on the first request. Reading the
# patterns here imports them before the worker accepts, so a broken view stops the boot instead.
get_resolver().url_patterns
