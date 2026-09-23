# Built from this directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ is never copied in: Maven builds Implementation's pom with the parent above it and
# does not look for the parent's other modules.
FROM maven:3.9.16-eclipse-temurin-25@sha256:dd8e01b3be719853578c07b57ff8d9bbbbfe746f802226f05b19689420815221 AS build
WORKDIR /src

# The poms first, on their own layer, so a change to the code does not download the dependencies
# again. They name every version, Helidon's through its SE application parent, which is what makes
# the image the versions /__meta reports. go-offline leaves out the annotation processors and some
# of what Thymeleaf brings, so the package step is not offline.
COPY pom.xml ./
COPY Implementation/pom.xml Implementation/
RUN mvn -B -q -f Implementation/pom.xml dependency:go-offline
COPY Implementation/src Implementation/src
RUN mvn -B -q -f Implementation/pom.xml package -DskipTests

# The jar names each dependency under libs/ in its manifest, as Helidon packages an application.
FROM eclipse-temurin:25-jre@sha256:bb036ed6cfdc57e3da7c22634d15f1b840d2caf76183861c80e81ca4b5104abb
COPY --from=build /src/Implementation/target/libs /app/libs
COPY --from=build /src/Implementation/target/implementation.jar /app/implementation.jar
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/implementation.jar"]
