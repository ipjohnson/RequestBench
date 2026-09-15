package rb.quarkus.filters;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.ext.Provider;
import rb.quarkus.Layers;

/** middleware: layer 3 of 4 on /middleware/four. It runs and does nothing else. */
@Provider
@Layers.Four
public class NoopFour02 implements ContainerRequestFilter {

  @Override
  public void filter(ContainerRequestContext ctx) { }
}
