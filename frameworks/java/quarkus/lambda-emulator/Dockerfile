# Built from the framework's directory alone, so nothing outside it reaches the image. Neither UnitTests/ nor
# Client/ is copied in: Maven builds Implementation's pom with the parent above it, and the profile
# that puts the Client in the suite turns on only where Client/pom.xml exists.
FROM maven:3-eclipse-temurin-26@sha256:c30718f442eb39c55b2d45440bb849d8755ad8d9d6ef67aadefcce150267116f AS maven

# The builder image Quarkus's native guide names, with Mandrel 25.0.4.1 on UBI 9, whose glibc is 2.34,
# the glibc of Amazon Linux 2023 that the function runs on. native-image builds for the
# architecture the image is built on. The builder has no Maven, so it comes from the Maven image
# the container hosts build with, and runs on Mandrel's JDK.
FROM quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-25@sha256:9fa424e2f0fac1b17115692abed3f8c9617280c06a6ebdc4384becb7eb62f981 AS build
USER root
COPY --from=maven /usr/share/maven /usr/share/maven
ENV PATH=/usr/share/maven/bin:$PATH
WORKDIR /src

# The poms first, on their own layer, so a change to the code does not download the dependencies
# again. They name every version through the Quarkus platform BOM, which is what makes the image
# the versions /__meta reports. quarkus:go-offline also resolves each extension's build-time
# artifacts, which Maven's dependency plugin does not know about.
COPY pom.xml ./
COPY Implementation/pom.xml Implementation/
RUN mvn -B -q -f Implementation/pom.xml -Plambda-emulator dependency:go-offline quarkus:go-offline
COPY Implementation/src Implementation/src
# The lambda-emulator profile adds quarkus-amazon-lambda-http and turns on Quarkus's native build,
# which writes implementation-0.0.0-runner.
RUN mvn -B -q -o -f Implementation/pom.xml -Plambda-emulator package -DskipTests

# The executable sits in the task root as runner, where Quarkus's function.zip puts it beside a
# bootstrap of the function's own. The base image's entrypoint execs /var/runtime/bootstrap, and
# refuses to start without one argument, the handler, which the executable does not read.
FROM public.ecr.aws/lambda/provided:al2023@sha256:a4c93088e111b6c5c319548a0ac7685c7f28e91f30cb1fa7d4a9fbd0ad091f10
COPY --from=build /src/Implementation/target/implementation-0.0.0-runner ${LAMBDA_TASK_ROOT}/runner
COPY lambda-emulator/bootstrap /var/runtime/bootstrap
CMD ["rb"]
