# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ and the client in Client/ are never copied in: Maven builds Implementation's pom with
# the parent above it and does not look for the parent's other modules.
FROM maven:3-eclipse-temurin-26@sha256:c30718f442eb39c55b2d45440bb849d8755ad8d9d6ef67aadefcce150267116f AS build
WORKDIR /src

# The poms first, on their own layer, so a change to the code does not download most of the
# dependencies again. They name every version through the Micronaut platform's BOM, which is what
# makes the image the versions /__meta reports. dependency:go-offline leaves some of what the
# package step resolves unfetched, slf4j-api and netty-codec among them, so that step is online.
COPY pom.xml ./
COPY Implementation/pom.xml Implementation/
RUN mvn -B -q -f Implementation/pom.xml -Plambda-emulator dependency:go-offline
COPY Implementation/src Implementation/src
# The lambda-emulator profile adds the adapter, which the shade plugin puts in the one jar with the
# rest.
RUN mvn -B -q -f Implementation/pom.xml -Plambda-emulator package -DskipTests

# The Java runtime loads a function's jars from lib/ under the task root. The base image's
# entrypoint refuses to start without one argument, the handler. Micronaut's guide names its handler
# by class alone, and the runtime finds handleRequest through the RequestHandler interface.
FROM public.ecr.aws/lambda/java:25@sha256:075fdad1d8ec95a94b5f945140cabc24391bf18750ff924cee64219d50f08ccd
COPY --from=build /src/Implementation/target/implementation-0.0.0.jar ${LAMBDA_TASK_ROOT}/lib/
CMD ["io.micronaut.function.aws.proxy.payload2.APIGatewayV2HTTPEventFunction"]
