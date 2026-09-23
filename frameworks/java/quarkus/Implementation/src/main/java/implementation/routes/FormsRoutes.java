package implementation.routes;

import implementation.Echoed;
import implementation.Payloads;
import jakarta.ws.rs.BeanParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

/**
 * forms: bodies bound through Quarkus REST's form support. The urlencoded form binds to a record
 * whose components each name a field, and the multipart upload's file part arrives as a
 * FileUpload, written to Quarkus's uploads directory before the handler runs.
 */
@Path("/forms")
public class FormsRoutes {

    /** query.many's eight values, posted as a form. */
    public record Search(@RestForm int page, @RestForm int size, @RestForm String status, @RestForm String category,
                         @RestForm String sort, @RestForm String q, @RestForm int minPrice, @RestForm int maxPrice) {}

    public record UploadedFile(String name, long bytes) {}

    public record UploadEcho(String tenant, String requestId) {}

    public record Uploaded(UploadedFile file, UploadEcho echo) {}

    private final Payloads p;

    FormsRoutes(Payloads p) {
        this.p = p;
    }

    // rb:handler forms.urlencoded
    @POST
    @Path("urlencoded")
    public Echoed<Search> urlencoded(@BeanParam Search search) {
        return Echoed.of(p.small(), search);
    }

    // rb:handler forms.multipart
    @POST
    @Path("multipart")
    public Uploaded multipart(@RestForm String tenant, @RestForm String requestId, @RestForm FileUpload file) {
        return new Uploaded(new UploadedFile(file.fileName(), file.size()), new UploadEcho(tenant, requestId));
    }
}
