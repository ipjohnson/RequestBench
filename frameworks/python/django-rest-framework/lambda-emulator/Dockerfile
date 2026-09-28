# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ is never copied in.
FROM public.ecr.aws/lambda/python:3.14@sha256:9c1408961e7ccc6f4fa71f2991d9e285529c8efd806b4a072f378ba87bda1eaa AS build
COPY --from=ghcr.io/astral-sh/uv:0.12.17@sha256:10787c682e4184e4f290de1171fd4703dc63de99221f10fe1c99002ce7fa9acc /uv /bin/uv
WORKDIR /src

# --locked, so the function is built from the versions uv.lock records and /__meta reports, and
# --no-dev leaves out the suite's packages. The packages and the application go into one directory,
# the task root, as uv's AWS Lambda guide installs a function. They are compiled to bytecode here,
# so the function's init loads it rather than compiling every module it imports.
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock ./
RUN uv export --locked --no-dev -o requirements.txt \
 && uv pip install -r requirements.txt --target /task
COPY Implementation/ /task/
COPY lambda-emulator/server.py lambda-emulator/start.sh /task/
RUN python -m compileall -q /task

FROM public.ecr.aws/lambda/python:3.14@sha256:9c1408961e7ccc6f4fa71f2991d9e285529c8efd806b4a072f378ba87bda1eaa
COPY --from=build /task ${LAMBDA_TASK_ROOT}
# The Lambda Web Adapter, where Lambda looks for an extension. It answers each event through the
# server on AWS_LWA_PORT once /health answers, and streams every answer back.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.1.0@sha256:17cfd08eff1dfea3f6a9a1e9c65fdac80aa4919b6085e746615530f43f57d2f1 /lambda-adapter /opt/extensions/lambda-adapter
ENV AWS_LWA_INVOKE_MODE=response_stream AWS_LWA_PORT=8080 AWS_LWA_READINESS_CHECK_PATH=/health \
    RB_LAMBDA_ADAPTER="Lambda Web Adapter 1.1.0"
# In place of the base image's entrypoint, which runs awslambdaric, Python's runtime client. The
# adapter takes its place.
ENTRYPOINT ["/bin/sh", "start.sh"]
