# Build context is the repo root so spec/fixture.json can be baked in.
#   docker build -f targets/python/Dockerfile --build-arg TARGET=fastapi -t rb/python-fastapi .
#
# One install for all six targets, from the lockfile they share, so a difference between two
# of them is the framework rather than a transitive dependency one happened to resolve
# differently. The image therefore carries five frameworks it does not import, which is what
# the Node image does for the same reason.
ARG PYTHON_VERSION=3.14
FROM python:${PYTHON_VERSION}-slim
ARG TARGET
WORKDIR /app
COPY targets/python/requirements.txt ./targets/python/
RUN pip install --no-cache-dir -r targets/python/requirements.txt
COPY targets/python/_shared ./targets/python/_shared
COPY targets/python/_hosts ./targets/python/_hosts
# Whatever the target is called, it is copied to app/, so one entrypoint covers them all.
# The directory must stay free of an __init__.py: without one it is a namespace portion,
# which loses to the installed package of the same name, and targets/python is on sys.path.
COPY targets/python/${TARGET} ./targets/python/app
# Compiled here, as pip compiles the packages above, so a boot loads bytecode rather than
# compiling every module it imports. PYTHONDONTWRITEBYTECODE only stops a write at runtime.
RUN python -m compileall -q targets/python
COPY spec/fixture.json ./spec/fixture.json
ENV PORT=8080 RB_TARGET=app RB_FIXTURE=/app/spec/fixture.json PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
EXPOSE 8080
CMD ["python", "targets/python/_hosts/container.py"]
