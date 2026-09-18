package rb.micronaut.routes;

import io.micronaut.http.HttpResponse;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/**
 * compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
 *
 * These routes answer with the payload and nothing else. Whether it goes out gzipped is
 * decided by the Netty server's own compression, which runs on the whole server and takes its
 * level from application.properties.
 */
@Controller
public class Compressed {

  @Get("/compressed/small")
  HttpResponse<PayloadBody> small() {
    return HttpResponse.ok(Domain.payload("small")).header("x-rb-serial", Domain.nextSerial());
  }

  @Get("/compressed/medium")
  HttpResponse<PayloadBody> medium() {
    return HttpResponse.ok(Domain.payload("medium")).header("x-rb-serial", Domain.nextSerial());
  }

  @Get("/compressed/large")
  HttpResponse<PayloadBody> large() {
    return HttpResponse.ok(Domain.payload("large")).header("x-rb-serial", Domain.nextSerial());
  }
}
