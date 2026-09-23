# Built from this directory alone, so nothing outside it reaches the image. Neither UnitTests/ nor
# Client/ is copied in: Maven builds Implementation's pom with the parent above it, and the profile
# that puts the Client in the suite turns on only where Client/pom.xml exists.
FROM maven:3.9.16-eclipse-temurin-25@sha256:dd8e01b3be719853578c07b57ff8d9bbbbfe746f802226f05b19689420815221 AS build
WORKDIR /src

# The poms first, on their own layer, so a change to the code does not download the dependencies
# again. They name every version through the Quarkus platform BOM, which is what makes the image
# the versions /__meta reports. quarkus:go-offline also resolves each extension's build-time
# artifacts, which Maven's dependency plugin does not know about.
COPY pom.xml ./
COPY Implementation/pom.xml Implementation/
RUN mvn -B -q -f Implementation/pom.xml dependency:go-offline quarkus:go-offline
COPY Implementation/src Implementation/src
RUN mvn -B -q -o -f Implementation/pom.xml package -DskipTests

# The fast-jar Quarkus builds, copied as Quarkus's own Dockerfile.jvm copies it.
FROM eclipse-temurin:25-jre@sha256:bb036ed6cfdc57e3da7c22634d15f1b840d2caf76183861c80e81ca4b5104abb
COPY --from=build /src/Implementation/target/quarkus-app/lib/ /deployments/lib/
COPY --from=build /src/Implementation/target/quarkus-app/*.jar /deployments/
COPY --from=build /src/Implementation/target/quarkus-app/app/ /deployments/app/
COPY --from=build /src/Implementation/target/quarkus-app/quarkus/ /deployments/quarkus/
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/deployments/quarkus-run.jar"]
