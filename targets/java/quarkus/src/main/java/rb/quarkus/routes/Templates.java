package rb.quarkus.routes;

import io.quarkus.qute.Template;
import io.quarkus.qute.TemplateInstance;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

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
 */
@Path("/template")
@Produces(MediaType.TEXT_HTML)
public class Templates {

  @Inject
  Template items;

  private TemplateInstance render(String size) {
    PayloadBody body = Domain.payload(size);
    return items.data("size", body.size())
                .data("count", body.count())
                .data("items", body.items());
  }

  // rb:snippet template.small
  @GET
  @Path("small")
  public TemplateInstance small() {
    return render("small");
  }

  // rb:snippet template.medium
  @GET
  @Path("medium")
  public TemplateInstance medium() {
    return render("medium");
  }
}
