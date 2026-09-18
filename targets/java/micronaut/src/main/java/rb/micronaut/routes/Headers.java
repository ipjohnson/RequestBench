package rb.micronaut.routes;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Header;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;
import rb.domain.Model.PayloadWithEcho;

/**
 * headers: the request header map, left unread and then bound.
 *
 * /headers reads no header at all, so headers.many minus headers.few is the cost of
 * materialising the 25 nobody asked for. /headers/bind binds three with Micronaut's own
 * binding: @Header names the header and declares its type, and the conversion service
 * converts x-rb-account to an int before the method runs, the way the query family converts.
 */
@Controller
public class Headers {

  record Bound(String tenant, @JsonProperty("request_id") String requestId, int account) {}

  @Get("/headers")
  PayloadBody headers() {
    return Domain.payload("small");
  }

  @Get("/headers/bind")
  PayloadWithEcho bind(@Header("x-rb-tenant") String tenant,
                       @Header("x-rb-request-id") String requestId,
                       @Header("x-rb-account") int account) {
    return Domain.withEcho("small", new Bound(tenant, requestId, account));
  }
}
