# Built from this directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ is never copied in.
FROM python:3.14-slim@sha256:caaf356f40667c496d405780745b9ac25771c189a51dfcc42430d531ea09f8a2 AS build
COPY --from=ghcr.io/astral-sh/uv:0.12.17@sha256:10787c682e4184e4f290de1171fd4703dc63de99221f10fe1c99002ce7fa9acc /uv /bin/uv
WORKDIR /app

# --locked, so the image is built from the versions uv.lock records and /__meta reports. --no-dev
# leaves out pytest and sanic-testing. The packages are compiled to bytecode here, so a worker's
# boot loads it rather than compiling every module it imports.
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev

# The same base, so the environment's interpreter link resolves, and no uv.
FROM python:3.14-slim@sha256:caaf356f40667c496d405780745b9ac25771c189a51dfcc42430d531ea09f8a2
WORKDIR /app
COPY --from=build /app/.venv .venv
COPY Implementation/ Implementation/
RUN .venv/bin/python -m compileall -q Implementation

ENV PATH=/app/.venv/bin:$PATH PORT=8080 PYTHONUNBUFFERED=1
EXPOSE 8080
USER nobody
WORKDIR /app/Implementation
# server.py starts Sanic's manager, which starts two workers.
CMD ["python", "server.py"]
