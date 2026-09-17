package rb.quarkus.routes;

import jakarta.ws.rs.Consumes;
import jakarta.validation.Valid;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.Map;
import rb.domain.Domain;
import rb.quarkus.OrderIn;
import rb.domain.Model.BindResult;
import rb.domain.Model.ValidatedOrder;

/**
 * body: the parser and the validator, with size crossed against validation.
 *
 * Quarkus parses and binds the request body itself, so a body it cannot read fails inside
 * the framework rather than in the domain; Mappers turns that into the shared 422.
 *
 * bind parses and binds without validating, so validate minus bind is the validator alone
 * rather than the validator plus the parse.
 */
@Path("/body")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class BodyRoutes {

  // rb:handler body.bind_small
  @POST
  @Path("bind/small")
  public BindResult bindSmall(Map<String, Object> body) {
    return Domain.bindEcho(body);
  }

  // rb:handler body.bind_medium
  @POST
  @Path("bind/medium")
  public BindResult bindMedium(Map<String, Object> body) {
    return Domain.bindEcho(body);
  }

  // rb:handler body.validate_small,body.rejected_all,errors.malformed
  @POST
  @Path("validate/small")
  public ValidatedOrder validateSmall(@Valid OrderIn body) {
    return body.order();
  }

  // rb:handler body.validate_medium
  @POST
  @Path("validate/medium")
  public ValidatedOrder validateMedium(@Valid OrderIn body) {
    return body.order();
  }

  // Hibernate Validator reports every constraint that failed and offers no fail-fast mode
  // without configuring the ValidatorFactory for the whole application, which would change
  // this endpoint's neighbour too. So this row answers what Quarkus answers.
  // rb:handler body.rejected_first
  @POST
  @Path("validate/first-error")
  public ValidatedOrder validateFirst(@Valid OrderIn body) {
    return body.order();
  }
}
