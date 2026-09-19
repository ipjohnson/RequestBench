package rb.quarkus.routes;

import io.quarkus.qute.Template;
import io.quarkus.qute.TemplateData;
import io.quarkus.qute.TemplateInstance;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;
import rb.domain.Model.Product;

/**
 * template: server-side rendering of the same model the json family serializes.
 *
 * Qute, which is Quarkus's own templating and the only engine it ships. The injected
 * Template is located by field name at build time and the handler returns a
 * TemplateInstance rather than a string, so no method here calls a render function.
 *
 * Quarkus is the reason this family is no longer one engine within Java. Qute is not
 * pluggable onto another engine, so using the framework's own facility means using its own
 * engine, and /__meta is what says so.
 *
 * {@code @TemplateData} has Quarkus generate a value resolver for Product at build time, so
 * each row's expressions call the record's accessors directly rather than through Qute's
 * reflection-based resolver.
 */
@TemplateData(target = Product.class)
@Path("/template")
@Produces(MediaType.TEXT_HTML)
public class Templates {

  @Inject
  // rb:wiring template.*
  Template items;

  // rb:wiring template.*
  private TemplateInstance render(String size) {
    PayloadBody body = Domain.payload(size);
    return items.data("size", body.size())
                .data("count", body.count())
                .data("items", body.items());
  }

  // rb:handler template.small
  @GET
  @Path("small")
  public TemplateInstance small() {
    return render("small");
  }

  // rb:handler template.medium
  @GET
  @Path("medium")
  public TemplateInstance medium() {
    return render("medium");
  }
}
