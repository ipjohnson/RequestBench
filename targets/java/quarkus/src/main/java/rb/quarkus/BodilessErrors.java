package rb.quarkus;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.ext.Provider;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Gives a body to an error response Quarkus left without one.
 *
 * Quarkus REST answers a body it could not deserialize with a bare 400: content-length zero,
 * no content-type, and no exception raised. Nothing is thrown, so no ExceptionMapper and no
 * @ServerExceptionMapper is ever consulted -- verified by mapping Throwable and watching it
 * never fire. A response filter is the only hook the framework offers on that path.
 *
 * This is the one place a Quarkus answer is reshaped rather than reported. The repository's
 * response contract requires every response to declare its type, and a bodiless 400 does
 * not; the choice is a filter here or a weaker contract for every target. The status is
 * Quarkus's own and is untouched.
 */
@Provider
public class BodilessErrors implements ContainerResponseFilter {

  @Override
  public void filter(ContainerRequestContext request, ContainerResponseContext response) {
    if (response.getStatus() < 400 || response.hasEntity()) {
      return;
    }
    Map<String, Object> body = new LinkedHashMap<>(2);
    body.put("error", "invalid_body");
    body.put("detail", "the body could not be deserialized");
    response.setEntity(body);
    response.getHeaders().putSingle("content-type", "application/json");
  }
}
