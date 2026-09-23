package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import io.quarkus.qute.CheckedTemplate;
import io.quarkus.qute.TemplateInstance;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

/**
 * template: Qute, Quarkus's own template engine, through quarkus-rest-qute. A handler returns a
 * TemplateInstance, and Quarkus REST renders it after the handler returns. The template is
 * type-safe: Qute checks every expression in it against Payload while the application is built.
 */
@Path("/template")
public class TemplateRoutes {

    // rb:wiring template.*
    @CheckedTemplate
    public static class Templates {

        /** templates/TemplateRoutes/page.html, with the payload as body. */
        public static native TemplateInstance page(Payload body);
    }

    private final Payloads p;

    TemplateRoutes(Payloads p) {
        this.p = p;
    }

    // rb:handler template.small
    @GET
    @Path("small")
    @Produces(MediaType.TEXT_HTML)
    public TemplateInstance small() {
        return Templates.page(p.small());
    }

    // rb:handler template.medium
    @GET
    @Path("medium")
    @Produces(MediaType.TEXT_HTML)
    public TemplateInstance medium() {
        return Templates.page(p.medium());
    }
}
