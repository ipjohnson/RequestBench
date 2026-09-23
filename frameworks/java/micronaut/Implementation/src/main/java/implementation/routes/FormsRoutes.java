package implementation.routes;

import implementation.Echoed;
import implementation.Payloads;
import implementation.Search;
import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.Body;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Part;
import io.micronaut.http.annotation.Post;
import io.micronaut.http.multipart.CompletedFileUpload;
import io.micronaut.serde.annotation.Serdeable;

/**
 * forms: bodies bound through Micronaut's form support. The urlencoded form binds to query.many's
 * record, and the multipart upload's parts bind to the handler's parameters, the file part as a
 * CompletedFileUpload that holds the whole part.
 */
@Controller
public class FormsRoutes {

    @Serdeable
    public record UploadedFile(String name, long bytes) {}

    @Serdeable
    public record UploadEcho(String tenant, String requestId) {}

    @Serdeable
    public record Uploaded(UploadedFile file, UploadEcho echo) {}

    private final Payloads p;

    FormsRoutes(Payloads p) {
        this.p = p;
    }

    @Post(value = "/forms/urlencoded", consumes = MediaType.APPLICATION_FORM_URLENCODED)
    public Echoed<Search> urlencoded(@Body Search search) {
        return Echoed.of(p.small(), search);
    }

    @Post(value = "/forms/multipart", consumes = MediaType.MULTIPART_FORM_DATA)
    public Uploaded multipart(@Part String tenant, @Part String requestId, @Part CompletedFileUpload file) {
        return new Uploaded(new UploadedFile(file.getFilename(), file.getSize()), new UploadEcho(tenant, requestId));
    }
}
