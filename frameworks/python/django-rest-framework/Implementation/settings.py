"""Django's settings, which each worker reads when wsgi.py sets Django up, with DRF's under
REST_FRAMEWORK. Several are made from settings.json, so the payloads are loaded here, before the
worker accepts a connection."""
import os
from pathlib import Path

from payloads import load

# The views read the payloads from here.
PAYLOADS = load(os.environ["RB_PAYLOADS"])

DEBUG = False
# The corpus reaches the container at whatever address it was given, so no Host is refused.
ALLOWED_HOSTS = ["*"]
ROOT_URLCONF = "urls"

# rest_framework, as DRF's installation guide lists it, and django-cors-headers, which asks to be
# listed for its system checks. Neither needs a database, and none is configured.
INSTALLED_APPS = ["rest_framework", "corsheaders"]

# startproject installs seven, and every one runs on every request. Two are kept. CorsMiddleware
# answers the cors family, and CORS_URLS_REGEX below keeps it to /cors/. CommonMiddleware writes
# Content-Length on every answer that is not streamed, which Django's responses leave out, so
# without it gunicorn would send every answer chunked. Sessions, CSRF, authentication, messages and
# the security and clickjacking headers are work the corpus never asks for.
# rb:wiring cors.*
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

# Django's own template language, which DRF's TemplateHTMLRenderer renders with. With DEBUG off the
# backend wraps its loaders in the cached one, so the template is parsed on its first render and
# kept.
# rb:wiring template.*
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [Path(__file__).resolve().parent / "templates"],
}]

# The store cache_page writes into, one in each worker. cache_page keeps a second entry for each
# path, naming the request headers that path varies on, and LocMemCache counts both against
# MAX_ENTRIES. So the capacity is settings.json's, plus one for each of the five cached paths.
CACHED_PATHS = 5
# rb:wiring cache.*
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "OPTIONS": {"MAX_ENTRIES": PAYLOADS.settings["cache"]["capacity"] + CACHED_PATHS},
    },
}

# django-cors-headers' policy, from settings.json, on the paths CORS_URLS_REGEX matches alone.
# rb:wiring cors.*
CORS_URLS_REGEX = r"^/cors/"
CORS_ALLOWED_ORIGINS = [PAYLOADS.settings["cors"]["origin"]]
CORS_ALLOW_METHODS = [PAYLOADS.settings["cors"]["method"]]
CORS_ALLOW_HEADERS = [PAYLOADS.settings["cors"]["header"]]
CORS_PREFLIGHT_MAX_AGE = PAYLOADS.settings["cors"]["maxAgeSeconds"]
# rb:end

REST_FRAMEWORK = {
    # JSONRenderer alone, of the two DRF installs. The other, the browsable API, answers a request
    # that accepts HTML with a page in place of the JSON.
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    # DRF's two default authentication classes read Django's sessions and users, which are not
    # installed. With no authentication, DRF's settings guide sets UNAUTHENTICATED_USER to None.
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "UNAUTHENTICATED_USER": None,
}
