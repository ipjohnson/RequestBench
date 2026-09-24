# Built from the framework's directory alone, so nothing outside it reaches the image. The suite in
# UnitTests/ is never copied in: Maven builds Implementation's pom with the parent above it and
# does not look for the parent's other modules.
FROM maven:3-eclipse-temurin-26@sha256:c30718f442eb39c55b2d45440bb849d8755ad8d9d6ef67aadefcce150267116f AS build
WORKDIR /src

# The poms first, on their own layer, so a change to the code does not download the dependencies
# again. They name every version, Vert.x's through its stack BOM, which is what makes the image
# the versions /__meta reports.
COPY pom.xml ./
COPY Implementation/pom.xml Implementation/
RUN mvn -B -q -f Implementation/pom.xml dependency:go-offline
COPY Implementation/src Implementation/src
RUN mvn -B -q -o -f Implementation/pom.xml package -DskipTests

FROM eclipse-temurin:25-jre@sha256:bb036ed6cfdc57e3da7c22634d15f1b840d2caf76183861c80e81ca4b5104abb
COPY --from=build /src/Implementation/target/implementation-0.0.0-fat.jar /app/server.jar
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/server.jar"]
