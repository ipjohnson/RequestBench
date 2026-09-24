# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ and the client in Client/ are never copied in: Maven builds Implementation's pom with
# the parent above it and does not look for the parent's other modules.
FROM maven:3-eclipse-temurin-26@sha256:c30718f442eb39c55b2d45440bb849d8755ad8d9d6ef67aadefcce150267116f AS maven

# Oracle GraalVM 25.0.4.1.1 on Oracle Linux 9, whose glibc is 2.34, the glibc of Amazon Linux 2023
# that the function runs on. micronaut-maven-plugin builds a native executable on this image, and a
# native Lambda function with the same GraalVM, which it downloads unpinned. native-image builds
# for the architecture the image is built on. The image has no Maven, so it comes from the Maven
# image the container hosts build with, and runs on GraalVM's JDK.
FROM container-registry.oracle.com/graalvm/native-image:25-ol9@sha256:12d30afb29dcfcf5cbcefcf0a0a77352f03f93937ca9ee72f39281fbc674112d AS build
COPY --from=maven /usr/share/maven /usr/share/maven
ENV PATH=/usr/share/maven/bin:$PATH
WORKDIR /src

# The poms first, on their own layer, so a change to the code does not download most of the
# dependencies again. They name every version through the Micronaut platform's BOM, which is what
# makes the image the versions /__meta reports. dependency:go-offline leaves some of what the
# package step resolves unfetched, slf4j-api and netty-codec among them, so that step is online.
COPY pom.xml ./
COPY Implementation/pom.xml Implementation/
RUN mvn -B -q -f Implementation/pom.xml -Plambda-emulator dependency:go-offline
COPY Implementation/src Implementation/src
# The lambda-emulator profile makes the packaging native-image, which builds the executable
# target/implementation with the custom runtime as its main class. native-image in JAVA_HOME also
# turns on micronaut-parent's graalvm profile, whose annotation processor writes the reflection
# metadata.
RUN mvn -B -q -f Implementation/pom.xml -Plambda-emulator package -DskipTests

# The executable sits in the task root as func, where Micronaut's function.zip puts it beside the
# bootstrap that starts it. The base image's entrypoint execs /var/runtime/bootstrap, and refuses
# to start without one argument, the handler, which the custom runtime does not read.
FROM public.ecr.aws/lambda/provided:al2023@sha256:a4c93088e111b6c5c319548a0ac7685c7f28e91f30cb1fa7d4a9fbd0ad091f10
COPY --from=build /src/Implementation/target/implementation ${LAMBDA_TASK_ROOT}/func
COPY lambda-emulator/bootstrap /var/runtime/bootstrap
CMD ["rb"]
