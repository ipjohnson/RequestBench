# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ is never copied in: Maven builds Implementation's pom with the parent above it and
# does not look for the parent's other modules.
# Helidon 27's jars are compiled for Java 27, and there is no Temurin 27 image yet, so this port
# builds and runs on Amazon Corretto 27. Maven comes from the Maven image, which has no Corretto 27
# variant.
FROM maven:3-eclipse-temurin-26@sha256:c30718f442eb39c55b2d45440bb849d8755ad8d9d6ef67aadefcce150267116f AS maven

FROM amazoncorretto:27-al2023-jdk@sha256:0e4efd9e1cea5ff517e97e23c526a626fbf57ca272d12ff26c6b8e402832f9f3 AS build
COPY --from=maven /usr/share/maven /usr/share/maven
ENV PATH=/usr/share/maven/bin:$PATH
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
FROM amazoncorretto:27-al2023-headless@sha256:9c4bc2122b86ad16e7f7059e1bc388571acae8ed5ce9be4c764f74ba3bed2f5a
COPY --from=build /src/Implementation/target/libs /app/libs
COPY --from=build /src/Implementation/target/implementation.jar /app/implementation.jar
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/implementation.jar"]
