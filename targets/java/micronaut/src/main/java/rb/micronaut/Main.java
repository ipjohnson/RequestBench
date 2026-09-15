package rb.micronaut;

import io.micronaut.runtime.Micronaut;
import rb.domain.Domain;
import rb.hosts.Hosts;

/**
 * RequestBench target: Micronaut. Framework wiring only; behaviour from rb-shared.
 *
 * One controller per endpoint family, under routes/. Micronaut finds them at compile time
 * from this package, so nothing here lists them.
 */
public class Main {

  public static void main(String[] args) throws Exception {
    Domain.load(Hosts.fixture());
    // PORT rather than MICRONAUT_SERVER_PORT, because every target reads the same variable.
    System.setProperty("micronaut.server.port", String.valueOf(Hosts.port()));
    Hosts.serializer("jackson " + Hosts.version("jackson"));
    Micronaut.run(Main.class, args);
  }
}
