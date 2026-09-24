# Built from the framework's directory alone, so nothing outside it reaches the image. Neither UnitTests/ nor
# Client/ is copied in: Maven builds Implementation's pom with the parent above it, and the profile
# that puts the Client in the suite turns on only where Client/pom.xml exists.
FROM maven:3-eclipse-temurin-26@sha256:c30718f442eb39c55b2d45440bb849d8755ad8d9d6ef67aadefcce150267116f AS build
WORKDIR /src

# The poms first, on their own layer, so a change to the code does not download the dependencies
# again. They name every version through the Quarkus platform BOM, which is what makes the image
# the versions /__meta reports. quarkus:go-offline also resolves each extension's build-time
# artifacts, which Maven's dependency plugin does not know about.
COPY pom.xml ./
COPY Implementation/pom.xml Implementation/
RUN mvn -B -q -f Implementation/pom.xml -Plambda-emulator dependency:go-offline quarkus:go-offline
COPY Implementation/src Implementation/src
# The lambda-emulator profile adds quarkus-amazon-lambda-http, which packages the application as a
# legacy jar, implementation-0.0.0-runner.jar, with its dependencies in target/lib.
RUN mvn -B -q -o -f Implementation/pom.xml -Plambda-emulator package -DskipTests

# Every jar goes in lib/ under the task root, where the Java runtime loads a function's jars from, as
# Quarkus's Lambda guide lays out a JVM container image. The base image's entrypoint refuses to
# start without one argument, the handler, which the runtime loads and calls with each event.
FROM public.ecr.aws/lambda/java:25@sha256:075fdad1d8ec95a94b5f945140cabc24391bf18750ff924cee64219d50f08ccd
COPY --from=build /src/Implementation/target/lib/ ${LAMBDA_TASK_ROOT}/lib/
COPY --from=build /src/Implementation/target/implementation-0.0.0-runner.jar ${LAMBDA_TASK_ROOT}/lib/
CMD ["io.quarkus.amazon.lambda.runtime.QuarkusStreamHandler::handleRequest"]
