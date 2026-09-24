"""RequestBench framework: Django over ASGI as a Lambda function, behind Mangum.

The base image's runtime client, awslambdaric, imports this module from the task root and calls
handler with each event it asks the Runtime API for. Mangum turns the event, an API Gateway payload
format 2.0 request, into an ASGI request for Django, and the answer into a proxy response.
"""
import os

# A function is one process, which answers one event at a time. It is set before asgi is imported,
# because views/contract.py imports it from this module.
WORKERS = 1

if "RB_PAYLOADS" not in os.environ:
    raise RuntimeError("RB_PAYLOADS has to name the payload directory")

from mangum import Mangum  # noqa: E402

from asgi import application  # noqa: E402

# Django implements no ASGI lifespan and refuses any scope but HTTP, so Mangum is told not to start
# one, as Mangum's Django example does.
handler = Mangum(application, lifespan="off")
