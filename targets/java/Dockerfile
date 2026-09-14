# Build context is the repo root so spec/fixture.json can be baked in.
#   docker build -f targets/java/Dockerfile --build-arg TARGET=baseline -t rb/java-bare-netty .
#
# Every target builds to the same target/server.jar, so one ENTRYPOINT covers them all.
ARG JAVA_VERSION=25
FROM maven:3.9-eclipse-temurin-${JAVA_VERSION} AS build
ARG TARGET=baseline
WORKDIR /src

# Poms first, on their own layer. Maven reads every module in the reactor even when -pl
# selects one, so they all have to be here; the sources come after so a code change does
# not re-resolve the dependency tree. The list mirrors <modules> in the parent pom.
COPY targets/java/pom.xml ./
COPY targets/java/shared/pom.xml shared/
COPY targets/java/hosts/pom.xml hosts/
COPY targets/java/baseline/pom.xml baseline/
COPY targets/java/javalin/pom.xml javalin/
COPY targets/java/vertx/pom.xml vertx/
COPY targets/java/helidon-se/pom.xml helidon-se/
COPY targets/java/spring-boot/pom.xml spring-boot/
COPY targets/java/micronaut/pom.xml micronaut/
COPY targets/java/quarkus/pom.xml quarkus/
RUN mvn -B -q -pl ${TARGET} -am dependency:go-offline

COPY targets/java/shared/src shared/src
COPY targets/java/hosts/src hosts/src
COPY targets/java/${TARGET}/src ${TARGET}/src
# Shaded targets produce server.jar; Quarkus names its uber jar server-runner.jar. One
# ENTRYPOINT covers both because whichever was built lands at the same path.
RUN mvn -B -q -pl ${TARGET} -am -DskipTests package \
 && cp "$(ls ${TARGET}/target/server.jar ${TARGET}/target/server-runner.jar 2>/dev/null | head -1)" /server.jar

FROM eclipse-temurin:${JAVA_VERSION}-jre
ARG TARGET=baseline
COPY --from=build /server.jar /app/server.jar
COPY spec/fixture.json /app/spec/fixture.json
ENV RB_FIXTURE=/app/spec/fixture.json PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/server.jar"]
