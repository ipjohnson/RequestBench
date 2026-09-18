package rb.spring.routes;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;
import rb.domain.Model.PayloadWithEcho;

/**
 * headers: the request header map, left unread and then bound.
 *
 * /headers reads no header at all, so headers.many minus headers.few is the cost of
 * materialising the 25 nobody asked for. /headers/bind binds three with Spring's own
 * binding: @RequestHeader names the header and declares its type, and Spring converts
 * x-rb-account to an int before the method runs, the way the query family converts.
 */
@RestController
public class Headers {

  record Bound(String tenant, @JsonProperty("request_id") String requestId, int account) {}

  @GetMapping("/headers")
  PayloadBody headers() {
    return Domain.payload("small");
  }

  @GetMapping("/headers/bind")
  PayloadWithEcho bind(@RequestHeader("x-rb-tenant") String tenant,
                       @RequestHeader("x-rb-request-id") String requestId,
                       @RequestHeader("x-rb-account") int account) {
    return Domain.withEcho("small", new Bound(tenant, requestId, account));
  }
}
