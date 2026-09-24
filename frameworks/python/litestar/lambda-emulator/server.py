"""RequestBench framework: Litestar as a Lambda function, behind Mangum.

The base image's runtime client, awslambdaric, imports this module from the task root and calls
handler with each event it asks the Runtime API for. Mangum turns the event, an API Gateway payload
format 2.0 request, into an ASGI request for the application, and the answer into a proxy response.
"""
import logging
import os
from importlib.metadata import version

# A function is one process, which answers one event at a time. It is set before main is imported,
# because routes/contract.py imports it from this module.
WORKERS = 1
# What /__meta names as the adapter. contract.py imports it with WORKERS.
ADAPTER = f"Mangum {version('mangum')}"

if "RB_PAYLOADS" not in os.environ:
    raise RuntimeError("RB_PAYLOADS has to name the payload directory")

from mangum import Mangum  # noqa: E402

from main import app  # noqa: E402

# Mangum logs a line at INFO for every request it answers, and Litestar's default logging
# configuration writes the root logger's INFO records to stderr. No other framework in the corpus
# logs a request, so Mangum's logger is kept to warnings, as uvicorn's access log is off on
# container-h1.
logging.getLogger("mangum").setLevel(logging.WARNING)

# Mangum runs the ASGI lifespan's startup and shutdown around every event rather than once. The
# application registers nothing for either, so lifespan is off, as Mangum's README examples set it.
handler = Mangum(app, lifespan="off")
