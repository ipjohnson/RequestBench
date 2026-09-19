package rb.gcp;

import rb.domain.Domain;
import rb.hosts.Hosts;

/**
 * Host: gcp-func, for Micronaut.
 *
 * Micronaut's own Functions Framework adapter, so the routes the container host serves are
 * the routes measured here. Named rb.gcp.Function like every other target's function, so
 * one command line in Dockerfile.gcp covers them all.
 */
public class Function extends io.micronaut.gcp.function.http.HttpFunction {

  static {
    try {
      Domain.load(Hosts.fixture());
    } catch (Exception e) {
      throw new ExceptionInInitializerError(e);
    }
    Hosts.adapter("micronaut-gcp-function-http");
    Hosts.serializer(rb.micronaut.Main.SERIALIZER);
  }
}
