# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ and the client in Client/ are never copied in.
FROM public.ecr.aws/lambda/python:3.14@sha256:9c1408961e7ccc6f4fa71f2991d9e285529c8efd806b4a072f378ba87bda1eaa AS build
COPY --from=ghcr.io/astral-sh/uv:0.12.17@sha256:10787c682e4184e4f290de1171fd4703dc63de99221f10fe1c99002ce7fa9acc /uv /bin/uv
WORKDIR /src

# --locked, so the function is built from the versions uv.lock records and /__meta reports. The
# lambda-emulator group adds Mangum, and --no-dev leaves out the suite's packages. The packages and
# the application go into one directory, the task root, as uv's AWS Lambda guide installs a
# function. They are compiled to bytecode here, so the function's init loads it rather than
# compiling every module it imports.
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock ./
RUN uv export --locked --no-dev --group lambda-emulator -o requirements.txt \
 && uv pip install -r requirements.txt --target /task
COPY Implementation/ /task/
COPY lambda-emulator/server.py /task/
RUN python -m compileall -q /task

# The base image's entrypoint refuses to start without one argument, the handler, and execs the
# bootstrap, which runs awslambdaric, the runtime client. The client imports server from the task
# root and calls its handler with each event.
FROM public.ecr.aws/lambda/python:3.14@sha256:9c1408961e7ccc6f4fa71f2991d9e285529c8efd806b4a072f378ba87bda1eaa
COPY --from=build /task ${LAMBDA_TASK_ROOT}
CMD ["server.handler"]
