package rb.spring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import rb.domain.Domain;
import rb.hosts.Hosts;

/**
 * RequestBench target: Spring Boot. Framework wiring only; behaviour from rb-shared.
 *
 * One controller per endpoint family, under routes/. Spring finds them by component scan
 * from this package, so nothing here lists them. Forty-five handlers in one file is a file
 * nobody reads, and a family is the unit a rewiring or a rerun is scoped to.
 */
@SpringBootApplication
public class Main {

  public static void main(String[] args) throws Exception {
    Domain.load(Hosts.fixture());
    // PORT rather than SERVER_PORT, because every target in every language reads the same
    // variable and the container contract names that one.
    System.setProperty("server.port", String.valueOf(Hosts.port()));
    // Spring Boot 4 serializes with Jackson 3, not the Jackson 2 the other targets share.
    // Its version comes from the spring-boot BOM rather than this repo's jackson pin.
    Hosts.serializer("jackson " + tools.jackson.core.Version.class.getPackage()
                                     .getImplementationVersion());
    SpringApplication app = new SpringApplication(Main.class);
    app.setBannerMode(org.springframework.boot.Banner.Mode.OFF);
    app.run(args);
  }
}
