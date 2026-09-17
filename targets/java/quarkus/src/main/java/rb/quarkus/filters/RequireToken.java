package rb.quarkus.filters;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import rb.domain.Domain;
import rb.quarkus.Layers;

/**
 * authorized: the framework's authorization mechanism, crypto excluded.
 *
 * A JAX-RS request filter bound by name to the one method, not an if in the handler. An if
 * would measure the language; the point of the family is the framework's own plumbing.
 */
@Provider
@Layers.Authorized
// rb:wiring authorized.*
public class RequireToken implements ContainerRequestFilter {

  @Override
  public void filter(ContainerRequestContext ctx) {
    if (!Domain.tokenOk(ctx.getHeaderString("authorization"))) {
      ctx.abortWith(Response.status(403).entity(Domain.forbiddenBody()).build());
    }
  }
}
