package rb.micronaut.routes;

import io.micronaut.http.HttpResponse;
import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import rb.domain.Domain;
import rb.hosts.Views;

/**
 * template: server-side rendering of the same model the json family serializes.
 *
 * The engine is jmustache, shared with every other Java target and named on /__meta.
 */
@Controller
public class Templates {

  @Get("/template/small")
  HttpResponse<String> small() {
    return HttpResponse.ok(Views.renderItems(Domain.payload("small")))
                       .contentType(MediaType.TEXT_HTML);
  }

  @Get("/template/medium")
  HttpResponse<String> medium() {
    return HttpResponse.ok(Views.renderItems(Domain.payload("medium")))
                       .contentType(MediaType.TEXT_HTML);
  }
}
