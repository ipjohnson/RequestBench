package rb.micronaut.routes;

import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/**
 * headers: eager against lazy construction of the request header map.
 *
 * The handler reads no header at all, so headers.many minus headers.few is the cost of
 * materialising 27 nobody asked for.
 */
@Controller
public class Headers {

  @Get("/headers")
  PayloadBody headers() {
    return Domain.payload("small");
  }
}
