package rb.quarkus.routes;

import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import rb.domain.Model.QueryMany;
import rb.domain.Model.QueryOne;

/**
 * query: query string parsing and coercion, isolated from any use of the values.
 *
 * JAX-RS's own binding: @QueryParam names the parameter and the method signature declares its
 * type, and RESTEasy converts what the router parsed before the method runs. @DefaultValue is
 * what an absent one is; a value the converter refuses is what JAX-RS answers for a parameter
 * it could not convert, not something this repository decides.
 */
@Path("/query")
@Produces(MediaType.APPLICATION_JSON)
public class Query {

  // rb:handler query.one
  @GET
  @Path("one")
  public QueryOne one(@QueryParam("page") @DefaultValue("0") int page) {
    return new QueryOne(page);
  }

  // rb:handler query.many
  @GET
  @Path("many")
  public QueryMany many(@QueryParam("page") @DefaultValue("0") int page,
                        @QueryParam("size") @DefaultValue("0") int size,
                        @QueryParam("status") @DefaultValue("") String status,
                        @QueryParam("category") @DefaultValue("") String category,
                        @QueryParam("sort") @DefaultValue("") String sort,
                        @QueryParam("q") @DefaultValue("") String q,
                        @QueryParam("min_price") @DefaultValue("0") int minPrice,
                        @QueryParam("max_price") @DefaultValue("0") int maxPrice) {
    return new QueryMany(page, size, status, category, sort, q, minPrice, maxPrice);
  }
}
