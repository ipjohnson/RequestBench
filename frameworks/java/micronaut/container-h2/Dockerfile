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
RUN mvn -B -q -f Implementation/pom.xml dependency:go-offline
COPY Implementation/src Implementation/src
RUN mvn -B -q -f Implementation/pom.xml package -DskipTests

FROM eclipse-temurin:25-jre@sha256:bb036ed6cfdc57e3da7c22634d15f1b840d2caf76183861c80e81ca4b5104abb
COPY --from=build /src/Implementation/target/implementation-0.0.0.jar /app/server.jar
ENV PORT=8080
# Micronaut's own switch, with which its Netty server answers HTTP/2 with prior knowledge on a plain port.
ENV MICRONAUT_SERVER_HTTP_VERSION=2.0
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/server.jar"]
