package rb.quarkus;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import rb.domain.Domain;
import rb.hosts.Hosts;

/**
 * Quarkus owns main, so the fixture is loaded from a startup observer rather than before
 * the server starts. Nothing serves a request until this returns, which is what the
 * readiness probe on /health is waiting for.
 */
@ApplicationScoped
public class Startup {

  void onStart(@Observes StartupEvent event) throws Exception {
    Domain.load(Hosts.fixture());
    Hosts.serializer("jackson " + Hosts.version("jackson"));
  }
}
