package rb.micronaut.routes;

import io.micronaut.http.HttpResponse;
import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import java.util.Map;
import rb.hosts.Hosts;

/** baseline: dispatch floor, no serialization. */
@Controller
public class Baseline {

  // The content type is set on the response rather than declared with @Produces, which
  // restricts matching against the gate's Accept: application/json.
  @Get("/plaintext")
  HttpResponse<String> plaintext() {
    return HttpResponse.ok("Hello, World!").contentType(MediaType.TEXT_PLAIN);
  }

  @Get("/health")
  HttpResponse<String> health() {
    return HttpResponse.ok("ok").contentType(MediaType.TEXT_PLAIN);
  }

  @Get("/__meta")
  Map<String, Object> meta() {
    return Hosts.meta("micronaut", Hosts.version("micronaut"), "thymeleaf",
                      "sha1 (micronaut ships no conditional handling)", "a shared LRU");
  }
}
