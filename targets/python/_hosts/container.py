"""Host: container. The framework starts its own server, which is what people deploy.

The target module is loaded by file path rather than imported by name, because four of the
six directories are named after the package they wire -- targets/python/fastapi beside
site-packages/fastapi -- and one of them, django-asgi, is not a legal module name at all.

targets/python is still on sys.path, for `_shared` and `_hosts`. That is only safe while
no target directory holds an __init__.py: without one the directory is a namespace portion,
which loses to an installed regular package of the same name. Adding one would shadow the
framework the target is supposed to measure.
"""
import importlib.util
import os
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
LANGUAGE = HERE.parent
sys.path.insert(0, str(LANGUAGE))

target = os.environ.get("RB_TARGET")
if not target:
    raise SystemExit("RB_TARGET is not set")

path = LANGUAGE / target / "app.py"
if not path.exists():
    raise SystemExit("no target at %s" % path)

spec = importlib.util.spec_from_file_location("rb_target", path)
app = importlib.util.module_from_spec(spec)
# Registered before it is executed: Django resolves ROOT_URLCONF by module name, and
# importing it a second time would configure settings twice.
sys.modules[spec.name] = app
spec.loader.exec_module(app)

app.serve()
