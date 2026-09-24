# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ is never copied in: Maven builds Implementation's pom with the parent above it and
# does not look for the parent's other modules.
FROM maven:3-eclipse-temurin-26@sha256:c30718f442eb39c55b2d45440bb849d8755ad8d9d6ef67aadefcce150267116f AS build
WORKDIR /src

# The poms first, on their own layer, so a change to the code does not download the dependencies
# again. They name every version through Boot's BOM, and the adapter's in the lambda-emulator
# profile, which is what makes the image the versions /__meta reports.
COPY pom.xml ./
COPY Implementation/pom.xml Implementation/
RUN mvn -B -q -f Implementation/pom.xml -Plambda-emulator dependency:go-offline
COPY Implementation/src Implementation/src
COPY lambda-emulator/ lambda-emulator/
# The profile compiles StreamLambdaHandler from lambda-emulator/ beside the application.
# copy-dependencies puts every runtime jar in target/dependency.
RUN mvn -B -q -o -f Implementation/pom.xml -Plambda-emulator package dependency:copy-dependencies -DincludeScope=runtime -DskipTests

# The Java runtime loads a function's classes from the task root and its jars from lib/ under it.
# The base image's entrypoint refuses to start without one argument, the handler, which the runtime
# loads and calls with each event.
FROM public.ecr.aws/lambda/java:25@sha256:075fdad1d8ec95a94b5f945140cabc24391bf18750ff924cee64219d50f08ccd
COPY --from=build /src/Implementation/target/classes/ ${LAMBDA_TASK_ROOT}/
COPY --from=build /src/Implementation/target/dependency/ ${LAMBDA_TASK_ROOT}/lib/
CMD ["implementation.StreamLambdaHandler::handleRequest"]
