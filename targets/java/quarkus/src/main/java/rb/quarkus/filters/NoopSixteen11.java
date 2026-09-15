package rb.quarkus.filters;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.ext.Provider;
import rb.quarkus.Layers;

/** middleware: layer 12 of 16 on /middleware/sixteen. It runs and does nothing else. */
@Provider
@Layers.Sixteen
public class NoopSixteen11 implements ContainerRequestFilter {

  @Override
  public void filter(ContainerRequestContext ctx) { }
}
