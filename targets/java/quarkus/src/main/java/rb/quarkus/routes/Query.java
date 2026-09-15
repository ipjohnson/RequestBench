package rb.quarkus.routes;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.UriInfo;
import java.util.LinkedHashMap;
import rb.domain.Domain;
import rb.domain.Model.QueryMany;
import rb.domain.Model.QueryOne;

/**
 * query: query string parsing and coercion, isolated from any use of the values.
 *
 * JAX-RS parses uriInfo.getQueryParameters(), which is the work this family measures; the
 * domain coerces what it parsed, so every target in the language answers the same values.
 */
@Path("/query")
@Produces(MediaType.APPLICATION_JSON)
public class Query {

  // rb:snippet query.one
  @GET
  @Path("one")
  public QueryOne one(@Context UriInfo uriInfo) {
    return Domain.coerceOne(new LinkedHashMap<>(uriInfo.getQueryParameters()));
  }

  // rb:snippet query.many
  @GET
  @Path("many")
  public QueryMany many(@Context UriInfo uriInfo) {
    return Domain.coerceMany(new LinkedHashMap<>(uriInfo.getQueryParameters()));
  }
}
