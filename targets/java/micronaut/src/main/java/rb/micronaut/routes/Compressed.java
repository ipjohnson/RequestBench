package rb.micronaut.routes;

import io.micronaut.http.HttpHeaders;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.MediaType;
import io.micronaut.http.MutableHttpResponse;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Header;
import rb.domain.Domain;
import rb.domain.Json;

/**
 * compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
 *
 * Micronaut's netty compression setting is on the whole server, which would put a "did the
 * client ask?" check on all forty-five endpoints and contaminate the rows this family is
 * measured against. These three routes carry it instead, with the codec pinned across every
 * language.
 */
@Controller
public class Compressed {

  /** The floor Micronaut's own netty compression defaults to. */
  // rb:wiring compressed.*
  private static final int THRESHOLD = 1024;

  // rb:wiring compressed.*
  private static MutableHttpResponse<byte[]> serve(String size, String accept) {
    byte[] raw = Json.bytes(Domain.payload(size));
    boolean wanted = accept != null && accept.contains("gzip") && raw.length >= THRESHOLD;
    byte[] out = wanted ? Domain.gzip(raw) : raw;
    MutableHttpResponse<byte[]> res = HttpResponse.ok(out)
        .contentType(MediaType.APPLICATION_JSON)
        .header("x-rb-serial", Domain.nextSerial());
    if (wanted) {
      res.header(HttpHeaders.CONTENT_ENCODING, "gzip")
         .header(HttpHeaders.VARY, "Accept-Encoding");
    }
    return res;
  }

  @Get("/compressed/small")
  MutableHttpResponse<byte[]> small(@Header(name = "accept-encoding", defaultValue = "") String a) {
    return serve("small", a);
  }

  @Get("/compressed/medium")
  MutableHttpResponse<byte[]> medium(@Header(name = "accept-encoding", defaultValue = "") String a) {
    return serve("medium", a);
  }

  @Get("/compressed/large")
  MutableHttpResponse<byte[]> large(@Header(name = "accept-encoding", defaultValue = "") String a) {
    return serve("large", a);
  }
}
